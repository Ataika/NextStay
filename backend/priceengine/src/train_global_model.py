import argparse
import json
import pickle
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sqlalchemy import text

# Allow running this file as a script from project root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features import get_model_feature_columns, load_schema, prepare_model_dataframe  # noqa: E402
from src.ml_utils import compute_metrics, time_based_split  # noqa: E402
from src.postgres_pricing_stack import create_postgres_engine, validate_table_name  # noqa: E402
from src.preprocessing import build_preprocessor  # noqa: E402


def evaluate_by_hotel(
    model: Pipeline,
    df: pd.DataFrame,
    feature_columns: list[str],
    target_column: str,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for hotel_id, group in df.groupby("hotel_id"):
        probs = model.predict_proba(group[feature_columns])[:, 1]
        metrics = compute_metrics(group[target_column], probs)
        rows.append(
            {
                "hotel_id": int(hotel_id),
                "rows": int(len(group)),
                "bookings": int(group[target_column].sum()),
                **metrics,
            }
        )
    return pd.DataFrame(rows).sort_values("hotel_id")


def save_artifacts(
    model: Pipeline,
    metadata: dict[str, Any],
    model_path: Path,
    metadata_path: Path,
) -> None:
    with open(model_path, "wb") as handle:
        pickle.dump(model, handle)
    with open(metadata_path, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2, default=str)


def load_training_dataframe(
    *,
    input_csv: str,
    database_url: str | None,
    input_table: str,
    input_query: str | None,
    limit: int,
) -> pd.DataFrame:
    if database_url:
        engine = create_postgres_engine(database_url)
        if input_query:
            query = text(input_query)
        else:
            table_name = validate_table_name(input_table)
            limit_sql = f" LIMIT {int(limit)}" if limit and limit > 0 else ""
            query = text(f"SELECT * FROM {table_name} ORDER BY stay_date, snapshot_date{limit_sql}")

        with engine.begin() as connection:
            return pd.read_sql_query(query, connection)

    raw_df = pd.read_csv(input_csv)
    if limit and limit > 0:
        raw_df = raw_df.head(limit).copy()
    return raw_df


def main() -> None:
    parser = argparse.ArgumentParser(description="Train global booking-probability model.")
    parser.add_argument(
        "--input-csv",
        default="synthetic_hotel_pricing.csv",
        help="Path to unified training dataset.",
    )
    parser.add_argument("--database-url", default="", help="Use Postgres instead of CSV input.")
    parser.add_argument("--input-table", default="ml.pricingdata")
    parser.add_argument("--input-query", default="", help="Optional custom SQL query for training input.")
    parser.add_argument("--limit", type=int, default=0, help="Optional row limit for CSV or SQL input.")
    parser.add_argument(
        "--schema-path",
        default="configs/feature_schema_v1.json",
        help="Path to feature schema contract JSON.",
    )
    parser.add_argument(
        "--artifacts-dir",
        default="artifacts",
        help="Directory for serialized model artifacts.",
    )
    parser.add_argument(
        "--outputs-dir",
        default="outputs",
        help="Directory for metric outputs.",
    )
    parser.add_argument("--train-fraction", type=float, default=0.70)
    parser.add_argument("--validation-fraction", type=float, default=0.15)
    args = parser.parse_args()

    artifacts_dir = Path(args.artifacts_dir)
    outputs_dir = Path(args.outputs_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    schema = load_schema(args.schema_path)
    raw_df = load_training_dataframe(
        input_csv=args.input_csv,
        database_url=args.database_url.strip() or None,
        input_table=args.input_table,
        input_query=args.input_query.strip() or None,
        limit=args.limit,
    )
    df = prepare_model_dataframe(raw_df, schema, include_target=True)

    # Keep a stable feature list for train + inference.
    feature_columns = get_model_feature_columns(schema)
    target_column = schema["target_column"]

    train_df, validation_df, test_df = time_based_split(
        df,
        date_column="stay_date",
        train_fraction=args.train_fraction,
        validation_fraction=args.validation_fraction,
    )

    preprocessor = build_preprocessor(schema)
    model = LogisticRegression(max_iter=3000, solver="lbfgs")
    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )

    pipeline.fit(train_df[feature_columns], train_df[target_column])

    validation_probs = pipeline.predict_proba(validation_df[feature_columns])[:, 1]
    test_probs = pipeline.predict_proba(test_df[feature_columns])[:, 1]

    validation_metrics = compute_metrics(validation_df[target_column], validation_probs)
    test_metrics = compute_metrics(test_df[target_column], test_probs)

    by_hotel_df = evaluate_by_hotel(
        model=pipeline,
        df=test_df,
        feature_columns=feature_columns,
        target_column=target_column,
    )
    by_hotel_df.to_csv(outputs_dir / "global_model_test_metrics_by_hotel.csv", index=False)

    overall_metrics_df = pd.DataFrame(
        [
            {"split": "validation", **validation_metrics},
            {"split": "test", **test_metrics},
        ]
    )
    overall_metrics_df.to_csv(outputs_dir / "global_model_overall_metrics.csv", index=False)

    scored_test = test_df[
        ["hotel_id", "room_type_id", "snapshot_date", "stay_date", "offered_price", target_column]
    ].copy()
    scored_test["predicted_probability"] = test_probs
    scored_test.to_csv(outputs_dir / "global_model_test_predictions.csv", index=False)

    metadata = {
        "model_name": "global_booking_model_v1",
        "schema_version": schema["schema_version"],
        "trained_at_utc": datetime.utcnow().isoformat(),
        "target_column": target_column,
        "feature_columns": feature_columns,
        "row_counts": {
            "total": int(len(df)),
            "train": int(len(train_df)),
            "validation": int(len(validation_df)),
            "test": int(len(test_df)),
        },
        "date_ranges": {
            "train_start": train_df["stay_date"].min(),
            "train_end": train_df["stay_date"].max(),
            "validation_start": validation_df["stay_date"].min(),
            "validation_end": validation_df["stay_date"].max(),
            "test_start": test_df["stay_date"].min(),
            "test_end": test_df["stay_date"].max(),
        },
        "metrics": {
            "validation": validation_metrics,
            "test": test_metrics,
        },
        "notes": (
            "Optional features are handled with NaN imputation + missing flags so one "
            "global schema works across heterogeneous hotels."
        ),
    }

    model_path = artifacts_dir / "global_booking_model_v1.pkl"
    metadata_path = artifacts_dir / "global_booking_model_v1_metadata.json"
    save_artifacts(pipeline, metadata, model_path, metadata_path)

    print("Training finished.")
    print(f"Model artifact: {model_path}")
    print(f"Metadata: {metadata_path}")
    print("Overall metrics:")
    print(overall_metrics_df.to_string(index=False))
    print("\nBy-hotel test metrics:")
    print(by_hotel_df.to_string(index=False))


if __name__ == "__main__":
    main()
