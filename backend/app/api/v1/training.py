"""Per-hotel model training API.

Endpoints:
  GET  /training/hotels                       — list hotels available for training
  POST /training/upload-and-train             — upload CSV + trigger async training job
  GET  /training/jobs                         — list jobs (optional ?hotel_id=)
  GET  /training/jobs/{job_id}                — poll a single job
  GET  /training/models                       — list model registry (optional ?hotel_id=)
  POST /training/models/{model_id}/promote    — set a model as active for its hotel
"""

import io
import json
import pickle
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from app.core.config import DATABASE_URL, DEV_OWNER_TOKEN, DEV_OWNER_TOKEN_ENABLED
from app.security.auth import get_current_user, get_db, security
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

router = APIRouter(tags=["training"])

# priceengine root is 3 levels up from this file: backend/app/api/v1 → backend/
PRICEENGINE_ROOT = Path(__file__).resolve().parents[3] / "priceengine"
ARTIFACTS_BASE = PRICEENGINE_ROOT / "artifacts"
SCHEMA_PATH = PRICEENGINE_ROOT / "configs" / "feature_schema_v1.json"

if str(PRICEENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PRICEENGINE_ROOT))


# ---------------------------------------------------------------------------
# Auth helper (same pattern as pricing_lab.py)
# ---------------------------------------------------------------------------


def _require_owner(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Any:
    if DEV_OWNER_TOKEN_ENABLED and credentials is not None and credentials.credentials == DEV_OWNER_TOKEN:
        return {"role": "OWNER"}
    user = get_current_user(credentials=credentials, db=db)
    if user.role.upper() not in ("OWNER", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")
    return user


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------


class HotelOption(BaseModel):
    hotelId: int
    hotelName: str
    hotelSegment: str


class TrainingJobResponse(BaseModel):
    id: int
    hotelId: int
    status: str
    triggeredAt: str
    startedAt: str | None = None
    completedAt: str | None = None
    errorMessage: str | None = None
    datasetRowCount: int | None = None
    modelVersion: str | None = None
    configJson: dict | None = None


class ModelRegistryEntry(BaseModel):
    id: int
    hotelId: int
    modelVersion: str
    modelPath: str
    schemaVersion: str | None = None
    metricsJson: dict | None = None
    isActive: bool
    rowCount: int | None = None
    trainedAt: str


# ---------------------------------------------------------------------------
# Row serializers
# ---------------------------------------------------------------------------


def _ts(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _row_to_job(row: dict) -> TrainingJobResponse:
    cfg = row.get("config_json")
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except Exception:
            cfg = None
    return TrainingJobResponse(
        id=int(row["id"]),
        hotelId=int(row["hotel_id"]),
        status=str(row["status"]),
        triggeredAt=_ts(row["triggered_at"]) or "",
        startedAt=_ts(row.get("started_at")),
        completedAt=_ts(row.get("completed_at")),
        errorMessage=row.get("error_message"),
        datasetRowCount=row.get("dataset_row_count"),
        modelVersion=row.get("model_version"),
        configJson=cfg if isinstance(cfg, dict) else None,
    )


def _row_to_model(row: dict) -> ModelRegistryEntry:
    metrics = row.get("metrics_json")
    if isinstance(metrics, str):
        try:
            metrics = json.loads(metrics)
        except Exception:
            metrics = None
    return ModelRegistryEntry(
        id=int(row["id"]),
        hotelId=int(row["hotel_id"]),
        modelVersion=str(row["model_version"]),
        modelPath=str(row["model_path"]),
        schemaVersion=row.get("schema_version"),
        metricsJson=metrics if isinstance(metrics, dict) else None,
        isActive=bool(row["is_active"]),
        rowCount=row.get("row_count"),
        trainedAt=_ts(row.get("trained_at")) or "",
    )


# ---------------------------------------------------------------------------
# Background training worker
# ---------------------------------------------------------------------------


def _run_training(job_id: int, hotel_id: int, config: dict[str, Any], db_url: str) -> None:
    """Trains a per-hotel logistic regression model. Runs in a daemon thread."""
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as session:
        session.execute(
            text("UPDATE pricing.training_jobs SET status='running', started_at=NOW() WHERE id=:id"),
            {"id": job_id},
        )
        session.commit()

        try:
            if str(PRICEENGINE_ROOT) not in sys.path:
                sys.path.insert(0, str(PRICEENGINE_ROOT))

            from src.features import (  # noqa: PLC0415
                get_model_feature_columns,
                load_schema,
                prepare_model_dataframe,
            )
            from src.ml_utils import compute_metrics, time_based_split  # noqa: PLC0415
            from src.preprocessing import build_preprocessor  # noqa: PLC0415

            with engine.begin() as conn:
                df = pd.read_sql_query(
                    text("SELECT * FROM ml.pricingdata WHERE hotel_id = :hid ORDER BY stay_date, snapshot_date"),
                    conn,
                    params={"hid": hotel_id},
                )

            if len(df) < 50:
                raise ValueError(f"Not enough training data: {len(df)} rows (minimum 50 required).")

            schema = load_schema(str(SCHEMA_PATH))
            df_prepared = prepare_model_dataframe(df, schema, include_target=True)
            feature_columns = get_model_feature_columns(schema)
            target_column = schema["target_column"]

            train_fraction = float(config.get("train_fraction", 0.70))
            validation_fraction = float(config.get("validation_fraction", 0.15))

            train_df, val_df, test_df = time_based_split(
                df_prepared,
                date_column="stay_date",
                train_fraction=train_fraction,
                validation_fraction=validation_fraction,
            )

            preprocessor = build_preprocessor(schema)
            pipeline = Pipeline(
                [
                    ("preprocessor", preprocessor),
                    ("model", LogisticRegression(max_iter=3000, solver="lbfgs")),
                ]
            )
            pipeline.fit(train_df[feature_columns], train_df[target_column])

            val_probs = pipeline.predict_proba(val_df[feature_columns])[:, 1]
            test_probs = pipeline.predict_proba(test_df[feature_columns])[:, 1]
            val_metrics = compute_metrics(val_df[target_column], val_probs)
            test_metrics = compute_metrics(test_df[target_column], test_probs)

            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            model_version = f"hotel_{hotel_id}_v{timestamp}"

            hotel_dir = ARTIFACTS_BASE / f"hotel_{hotel_id}"
            hotel_dir.mkdir(parents=True, exist_ok=True)
            model_path = hotel_dir / f"{model_version}.pkl"
            metadata_path = hotel_dir / f"{model_version}_metadata.json"

            with open(model_path, "wb") as fh:
                pickle.dump(pipeline, fh)

            metadata = {
                "model_version": model_version,
                "hotel_id": hotel_id,
                "trained_at_utc": datetime.now(timezone.utc).isoformat(),
                "feature_columns": feature_columns,
                "row_counts": {
                    "total": int(len(df_prepared)),
                    "train": int(len(train_df)),
                    "validation": int(len(val_df)),
                    "test": int(len(test_df)),
                },
                "metrics": {"validation": val_metrics, "test": test_metrics},
            }
            with open(metadata_path, "w", encoding="utf-8") as fh:
                json.dump(metadata, fh, indent=2, default=str)

            result = session.execute(
                text(
                    "INSERT INTO pricing.hotel_model_registry "
                    "    (hotel_id, model_version, model_path, metadata_path, "
                    "     schema_version, metrics_json, is_active, row_count) "
                    "VALUES (:hid, :mv, :mp, :mtp, :sv, cast(:mj AS jsonb), FALSE, :rc) "
                    "RETURNING id"
                ),
                {
                    "hid": hotel_id,
                    "mv": model_version,
                    "mp": str(model_path),
                    "mtp": str(metadata_path),
                    "sv": schema.get("schema_version", "v1"),
                    "mj": json.dumps({"validation": val_metrics, "test": test_metrics}),
                    "rc": int(len(df_prepared)),
                },
            )
            registry_id = result.scalar_one()

            session.execute(
                text(
                    "UPDATE pricing.training_jobs "
                    "SET status='completed', completed_at=NOW(), "
                    "    model_version=:mv, model_registry_id=:rid, dataset_row_count=:rc "
                    "WHERE id=:id"
                ),
                {
                    "id": job_id,
                    "mv": model_version,
                    "rid": registry_id,
                    "rc": int(len(df_prepared)),
                },
            )
            session.commit()

        except Exception as exc:  # noqa: BLE001
            session.execute(
                text(
                    "UPDATE pricing.training_jobs "
                    "SET status='failed', completed_at=NOW(), error_message=:err "
                    "WHERE id=:id"
                ),
                {"id": job_id, "err": str(exc)[:2000]},
            )
            session.commit()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/training/hotels", response_model=list[HotelOption])
def list_hotels(
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> list[HotelOption]:
    rows = db.execute(
        text(
            "SELECT hotel_id, hotel_name, hotel_segment FROM core.dim_hotels WHERE is_current IS TRUE ORDER BY hotel_id"
        )
    ).mappings()
    return [
        HotelOption(
            hotelId=int(r["hotel_id"]),
            hotelName=str(r["hotel_name"]),
            hotelSegment=str(r["hotel_segment"]),
        )
        for r in rows
    ]


@router.post("/training/upload-and-train", response_model=TrainingJobResponse, status_code=201)
async def upload_and_train(
    hotel_id: int = Form(...),
    file: UploadFile = File(...),
    train_fraction: float = Form(default=0.70),
    validation_fraction: float = Form(default=0.15),
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> TrainingJobResponse:
    """Upload a hotel-specific CSV dataset and immediately queue a training job."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    # Verify hotel exists
    hotel_row = db.execute(
        text("SELECT hotel_id FROM core.dim_hotels WHERE hotel_id = :hid AND is_current IS TRUE"),
        {"hid": hotel_id},
    ).first()
    if hotel_row is None:
        raise HTTPException(status_code=404, detail=f"Hotel {hotel_id} not found.")

    # Parse CSV
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc

    if len(df) == 0:
        raise HTTPException(status_code=422, detail="CSV file is empty.")

    # Validate required feature columns
    from src.features import load_schema  # noqa: PLC0415

    schema = load_schema(str(SCHEMA_PATH))
    required_cols = {c["name"] for c in schema.get("features", []) if c.get("required", False)}
    required_cols.add(schema["target_column"])
    missing = required_cols - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required columns: {sorted(missing)}",
        )

    # Enforce hotel_id and add housekeeping columns
    df["hotel_id"] = hotel_id
    batch_ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    if "feature_schema_version" not in df.columns:
        df["feature_schema_version"] = schema.get("schema_version", "v1")
    if "source_batch_id" not in df.columns:
        df["source_batch_id"] = f"upload_{hotel_id}_{batch_ts}"
    # Drop created_at so Postgres uses its DEFAULT NOW()
    df = df.drop(columns=["created_at"], errors="ignore")

    # Insert into ml.pricingdata
    _engine = create_engine(DATABASE_URL)
    try:
        df.to_sql(
            "pricingdata",
            _engine,
            schema="ml",
            if_exists="append",
            index=False,
            chunksize=5000,
            method="multi",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load data into database: {exc}") from exc
    finally:
        _engine.dispose()

    # Create training job record
    cfg_json = json.dumps({"train_fraction": train_fraction, "validation_fraction": validation_fraction})
    result = db.execute(
        text(
            "INSERT INTO pricing.training_jobs (hotel_id, status, config_json) "
            "VALUES (:hid, 'pending', cast(:cfg AS jsonb)) "
            "RETURNING id, hotel_id, status, triggered_at, started_at, completed_at, "
            "          error_message, dataset_row_count, model_version, config_json"
        ),
        {"hid": hotel_id, "cfg": cfg_json},
    )
    row = dict(result.mappings().one())
    db.commit()

    # Launch background training thread
    thread = threading.Thread(
        target=_run_training,
        args=(
            row["id"],
            hotel_id,
            {"train_fraction": train_fraction, "validation_fraction": validation_fraction},
            DATABASE_URL,
        ),
        daemon=True,
    )
    thread.start()

    return _row_to_job(row)


@router.get("/training/jobs", response_model=list[TrainingJobResponse])
def list_jobs(
    hotel_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> list[TrainingJobResponse]:
    params: dict[str, Any] = {"limit": limit}
    where = "WHERE 1=1"
    if hotel_id is not None:
        where += " AND hotel_id = :hid"
        params["hid"] = hotel_id
    rows = db.execute(
        text(f"SELECT * FROM pricing.training_jobs {where} ORDER BY triggered_at DESC LIMIT :limit"),
        params,
    ).mappings()
    return [_row_to_job(dict(r)) for r in rows]


@router.get("/training/jobs/{job_id}", response_model=TrainingJobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> TrainingJobResponse:
    row = (
        db.execute(
            text("SELECT * FROM pricing.training_jobs WHERE id = :id"),
            {"id": job_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Training job not found.")
    return _row_to_job(dict(row))


@router.get("/training/models", response_model=list[ModelRegistryEntry])
def list_models(
    hotel_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> list[ModelRegistryEntry]:
    params: dict[str, Any] = {}
    where = "WHERE 1=1"
    if hotel_id is not None:
        where += " AND hotel_id = :hid"
        params["hid"] = hotel_id
    rows = db.execute(
        text(f"SELECT * FROM pricing.hotel_model_registry {where} ORDER BY trained_at DESC"),
        params,
    ).mappings()
    return [_row_to_model(dict(r)) for r in rows]


@router.post("/training/models/{model_id}/promote", response_model=ModelRegistryEntry)
def promote_model(
    model_id: int,
    db: Session = Depends(get_db),
    _auth: Any = Depends(_require_owner),
) -> ModelRegistryEntry:
    """Make a trained model the active model for its hotel."""
    row = (
        db.execute(
            text("SELECT * FROM pricing.hotel_model_registry WHERE id = :id"),
            {"id": model_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found.")

    hotel_id = int(row["hotel_id"])
    db.execute(
        text("UPDATE pricing.hotel_model_registry SET is_active = FALSE WHERE hotel_id = :hid"),
        {"hid": hotel_id},
    )
    db.execute(
        text("UPDATE pricing.hotel_model_registry SET is_active = TRUE WHERE id = :id"),
        {"id": model_id},
    )
    db.commit()

    updated = (
        db.execute(
            text("SELECT * FROM pricing.hotel_model_registry WHERE id = :id"),
            {"id": model_id},
        )
        .mappings()
        .first()
    )
    return _row_to_model(dict(updated))
