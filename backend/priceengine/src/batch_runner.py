"""Unified batch pricing runner. Replaces run_batch_pricing.py and run_batch_pricing_db.py.

Usage:
    python3 src/batch_runner.py --backend postgres --database-url postgresql://...
    python3 src/batch_runner.py --backend sqlite --db-path data/dpe_demo.db
    python3 src/batch_runner.py --backend csv --input-csv data.csv
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import text

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features import load_schema, prepare_model_dataframe  # noqa: E402
from src.minimal_stack_db import clear_table, get_connection, initialize_schema  # noqa: E402
from src.postgres_pricing_stack import (  # noqa: E402
    create_postgres_engine,
    ensure_postgres_pricing_stack,
    split_qualified_name,
    truncate_tables,
    validate_table_name,
)
from src.price_engine import PriceEngine, load_pricing_rules  # noqa: E402
from src.rules import apply_business_rules  # noqa: E402
from src.serving_config import load_json, should_route_to_dynamic_pricing  # noqa: E402


def _value_or_none(value: Any) -> float | None:
    if value is None:
        return None
    if pd.isna(value):
        return None
    return float(value)


def _safe_get(row: pd.Series, column: str, default: Any = None) -> Any:
    if column not in row:
        return default
    value = row[column]
    if pd.isna(value):
        return default
    return value


def _resolve_model_paths(
    model_path_arg: str | None,
    metadata_path_arg: str | None,
    serving_config: dict[str, Any] | None,
) -> tuple[str, str | None]:
    if model_path_arg:
        return model_path_arg, metadata_path_arg

    if serving_config is None:
        return "artifacts/champion_model.pkl", "artifacts/champion_model_metadata.json"

    champion_cfg = serving_config.get("champion_model", {})
    primary_model = champion_cfg.get("model_path", "artifacts/champion_model.pkl")
    primary_metadata = champion_cfg.get("metadata_path", "artifacts/champion_model_metadata.json")

    if Path(primary_model).exists():
        return primary_model, primary_metadata

    fallback_model = champion_cfg.get("fallback_model_path", "artifacts/logistic_regression.pkl")
    fallback_metadata = champion_cfg.get("fallback_metadata_path", "artifacts/logistic_regression_metadata.json")
    return fallback_model, fallback_metadata


def _fallback_price(
    *,
    prepared_row: pd.Series,
    previous_price: float | None,
    serving_config: dict[str, Any] | None,
    pricing_rules: dict[str, Any],
) -> tuple[float, str]:
    fallback_cfg = (serving_config or {}).get("fallback", {})
    strategy = fallback_cfg.get("strategy", "previous_price_then_base")
    apply_rules_flag = bool(fallback_cfg.get("apply_rules", True))

    base_price = float(prepared_row["base_price"])
    chosen = base_price
    reason = "fallback_base_price"

    if strategy == "previous_price_then_base":
        if previous_price is not None:
            chosen = float(previous_price)
            reason = "fallback_previous_price"
    elif strategy == "base_price":
        chosen = base_price
    elif strategy == "previous_price":
        if previous_price is not None:
            chosen = float(previous_price)
            reason = "fallback_previous_price"

    if apply_rules_flag:
        adjusted, applied_rules = apply_business_rules(
            candidate_price=chosen,
            hotel_segment=str(prepared_row["hotel_segment"]),
            base_price=base_price,
            is_weekend=int(prepared_row.get("is_weekend", 0)),
            is_holiday=int(prepared_row.get("is_holiday", 0)),
            pricing_rules=pricing_rules,
            previous_price=previous_price,
            manual_override_price=None,
        )
        if applied_rules:
            reason = f"{reason}+rules"
        return adjusted, reason

    return round(chosen, 2), reason


def _read_csv_input(args: argparse.Namespace) -> pd.DataFrame:
    raw_df = pd.read_csv(args.input_csv)
    if args.max_rows and args.max_rows > 0:
        raw_df = raw_df.head(args.max_rows).copy()
    return raw_df


def _read_sqlite_input(args: argparse.Namespace) -> pd.DataFrame:
    conn = get_connection(args.db_path)
    try:
        initialize_schema(conn)
        sql = "SELECT * FROM inventory_snapshots ORDER BY hotel_id, room_type_id, stay_date, snapshot_date"
        if args.limit and args.limit > 0:
            sql += f" LIMIT {int(args.limit)}"
        df = pd.read_sql_query(sql, conn)
        if df.empty:
            raise ValueError("No rows found in inventory_snapshots table.")
        return df
    finally:
        conn.close()


def _read_postgres_input(args: argparse.Namespace, source_batch_id: str | None) -> pd.DataFrame:
    engine = create_postgres_engine(args.database_url.strip())
    ensure_postgres_pricing_stack(engine)

    validated_table = validate_table_name(args.input_table)
    params: dict[str, Any] = {}
    filters: list[str] = []
    if source_batch_id:
        filters.append("source_batch_id = :source_batch_id")
        params["source_batch_id"] = source_batch_id

    where_sql = f" WHERE {' AND '.join(filters)}" if filters else ""
    limit_sql = f" LIMIT {int(args.limit)}" if args.limit and args.limit > 0 else ""
    query = text(
        f"SELECT * FROM {validated_table}{where_sql} "
        f"ORDER BY hotel_id, room_type_id, stay_date, snapshot_date{limit_sql}"
    )

    with engine.begin() as connection:
        df = pd.read_sql_query(query, connection, params=params)
    if df.empty:
        raise ValueError(f"No rows found in {args.input_table}.")
    return df


def _write_csv_output(
    args: argparse.Namespace,
    decisions_df: pd.DataFrame,
    published_df: pd.DataFrame,
) -> None:
    Path(args.decisions_output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.published_output).parent.mkdir(parents=True, exist_ok=True)
    decisions_df.to_csv(args.decisions_output, index=False)
    published_df.to_csv(args.published_output, index=False)
    print(f"Saved decisions: {args.decisions_output}")
    print(f"Saved published prices: {args.published_output}")


def _write_sqlite_output(
    args: argparse.Namespace,
    decisions_df: pd.DataFrame,
    published_df: pd.DataFrame,
) -> None:
    conn = get_connection(args.db_path)
    try:
        initialize_schema(conn)
        decisions_df.to_sql("price_decisions", conn, if_exists="append", index=False)
        published_df.to_sql("published_prices", conn, if_exists="append", index=False)
        total_decisions = conn.execute("SELECT COUNT(*) FROM price_decisions").fetchone()[0]
        total_published = conn.execute("SELECT COUNT(*) FROM published_prices").fetchone()[0]
        print(f"Total rows in price_decisions: {total_decisions}")
        print(f"Total rows in published_prices: {total_published}")
    finally:
        conn.close()


def _write_postgres_output(
    args: argparse.Namespace,
    decisions_df: pd.DataFrame,
    published_df: pd.DataFrame,
) -> None:
    engine = create_postgres_engine(args.database_url.strip())
    decisions_schema, decisions_name = split_qualified_name(args.decisions_table)
    published_schema, published_name = split_qualified_name(args.published_table)

    decisions_df.to_sql(
        decisions_name,
        engine,
        schema=decisions_schema,
        if_exists="append",
        index=False,
        chunksize=5000,
        method="multi",
    )
    published_df.to_sql(
        published_name,
        engine,
        schema=published_schema,
        if_exists="append",
        index=False,
        chunksize=5000,
        method="multi",
    )

    with engine.begin() as connection:
        total_decisions = connection.execute(
            text(f"SELECT COUNT(*) FROM {validate_table_name(args.decisions_table)}")
        ).scalar_one()
        total_published = connection.execute(
            text(f"SELECT COUNT(*) FROM {validate_table_name(args.published_table)}")
        ).scalar_one()
    print(f"Total rows in {args.decisions_table}: {total_decisions}")
    print(f"Total rows in {args.published_table}: {total_published}")


def _run_decision_loop(
    raw_df: pd.DataFrame,
    prepared_df: pd.DataFrame,
    engine: PriceEngine,
    pricing_rules: dict[str, Any],
    serving_config: dict[str, Any] | None,
    args: argparse.Namespace,
    updated_at: str,
    source_batch_id: str | None,
    postgres_mode: bool,
) -> tuple[list[dict], list[dict], dict[str, int]]:
    rollout_cfg = (serving_config or {}).get("rollout", {"enabled": False})
    fallback_enabled = bool((serving_config or {}).get("fallback", {}).get("enabled", True))

    prev_price_col = getattr(args, "prev_price_column", "offered_price")
    manual_override_col = getattr(args, "manual_override_column", "")

    decision_rows: list[dict[str, Any]] = []
    published_rows: list[dict[str, Any]] = []
    counters = {"in_rollout": 0, "skipped_rollout": 0, "ok": 0, "fallback": 0}

    for idx, prepared_row in prepared_df.iterrows():
        raw_row = raw_df.iloc[idx]
        hotel_id = int(raw_row["hotel_id"])
        hotel_segment = str(raw_row["hotel_segment"])
        room_type_id = int(raw_row["room_type_id"])
        stay_date = str(_safe_get(raw_row, "stay_date"))
        snapshot_date = str(_safe_get(raw_row, "snapshot_date"))
        previous_price = _value_or_none(_safe_get(raw_row, prev_price_col))

        manual_override_price = None
        if manual_override_col.strip():
            manual_override_price = _value_or_none(_safe_get(raw_row, manual_override_col.strip()))

        row_source_batch_id = str(_safe_get(raw_row, "source_batch_id", source_batch_id or "")) or source_batch_id or ""

        in_rollout = should_route_to_dynamic_pricing(
            hotel_id=hotel_id,
            hotel_segment=hotel_segment,
            stay_date=stay_date,
            room_type_id=room_type_id,
            snapshot_date=snapshot_date,
            rollout_config=rollout_cfg,
        )
        counters["in_rollout"] += int(in_rollout)
        counters["skipped_rollout"] += int(not in_rollout)

        recommendation = None
        inference_status = "ok"
        fallback_reason = ""

        if in_rollout:
            try:
                recommendation = engine.recommend_from_prepared_row(
                    prepared_row=prepared_row,
                    previous_price=previous_price,
                    manual_override_price=manual_override_price,
                )
            except Exception as exc:  # noqa: BLE001
                if not fallback_enabled:
                    raise
                fallback_price, fallback_reason = _fallback_price(
                    prepared_row=prepared_row,
                    previous_price=previous_price,
                    serving_config=serving_config,
                    pricing_rules=pricing_rules,
                )
                prob, exp_rev = engine.score_single_price(
                    prepared_row=prepared_row,
                    offered_price=fallback_price,
                )
                recommendation = {
                    "model_version": engine.model_version,
                    "rules_version": pricing_rules.get("rules_version", "unknown"),
                    "hotel_segment": hotel_segment,
                    "optimized_price": fallback_price,
                    "optimized_probability": prob,
                    "optimized_expected_revenue": exp_rev,
                    "final_price": fallback_price,
                    "predicted_probability": prob,
                    "expected_revenue": exp_rev,
                    "applied_rules": ["fallback"],
                    "candidate_count": 0,
                    "top_candidates": [],
                }
                inference_status = "fallback"
                fallback_reason = f"{fallback_reason}|{type(exc).__name__}"
        else:
            keep_price = previous_price if previous_price is not None else float(prepared_row["base_price"])
            prob, exp_rev = engine.score_single_price(
                prepared_row=prepared_row,
                offered_price=keep_price,
            )
            recommendation = {
                "model_version": engine.model_version,
                "rules_version": pricing_rules.get("rules_version", "unknown"),
                "hotel_segment": hotel_segment,
                "optimized_price": keep_price,
                "optimized_probability": prob,
                "optimized_expected_revenue": exp_rev,
                "final_price": keep_price,
                "predicted_probability": prob,
                "expected_revenue": exp_rev,
                "applied_rules": ["rollout_skip_keep_price"],
                "candidate_count": 0,
                "top_candidates": [],
            }
            inference_status = "skipped_rollout"
            fallback_reason = "rollout_not_routed"

        counters["ok"] += int(inference_status == "ok")
        counters["fallback"] += int(inference_status == "fallback")

        decision_record = {
            "hotel_id": hotel_id,
            "room_type_id": room_type_id,
            "stay_date": stay_date,
            "snapshot_date": snapshot_date,
            "offered_price": float(recommendation["final_price"]),
            "predicted_probability": float(recommendation["predicted_probability"]),
            "expected_revenue": float(recommendation["expected_revenue"]),
            "booking_made": _safe_get(raw_row, "booking_made", None),
            "cancellation": _safe_get(raw_row, "cancellation", None),
            "optimized_price": float(recommendation["optimized_price"]),
            "optimized_probability": float(recommendation["optimized_probability"]),
            "optimized_expected_revenue": float(recommendation["optimized_expected_revenue"]),
            "rule_adjustments": json.dumps(recommendation["applied_rules"]),
            "model_version": recommendation["model_version"],
            "rules_version": recommendation["rules_version"],
            "in_rollout": int(in_rollout),
            "inference_status": inference_status,
            "fallback_reason": fallback_reason,
            "created_at": updated_at,
        }
        if postgres_mode:
            decision_record["source_batch_id"] = row_source_batch_id
        decision_rows.append(decision_record)

        published_record = {
            "hotel_id": hotel_id,
            "room_type_id": room_type_id,
            "stay_date": stay_date,
            "snapshot_date": snapshot_date,
            "final_price": float(recommendation["final_price"]),
            "updated_at": updated_at,
            "in_rollout": int(in_rollout),
            "inference_status": inference_status,
        }
        if postgres_mode:
            published_record["model_version"] = recommendation["model_version"]
            published_record["rules_version"] = recommendation["rules_version"]
            published_record["source_batch_id"] = row_source_batch_id
        published_rows.append(published_record)

    return decision_rows, published_rows, counters


def main() -> None:
    parser = argparse.ArgumentParser(description="Run batch dynamic pricing.")
    parser.add_argument(
        "--backend",
        choices=["csv", "sqlite", "postgres"],
        default="postgres",
        help="Input/output backend.",
    )

    # CSV backend
    parser.add_argument("--input-csv", default="synthetic_hotel_pricing.csv")
    parser.add_argument("--decisions-output", default="outputs/price_decisions.csv")
    parser.add_argument("--published-output", default="outputs/published_prices.csv")
    parser.add_argument("--prev-price-column", default="offered_price")
    parser.add_argument("--manual-override-column", default="")
    parser.add_argument("--max-rows", type=int, default=0, help="Row cap for CSV mode. 0 = all rows.")

    # SQLite backend
    parser.add_argument("--db-path", default="data/dpe_demo.db")

    # Postgres backend
    parser.add_argument("--database-url", default="")
    parser.add_argument("--source-batch-id", default="")

    # Shared DB args (sqlite + postgres)
    parser.add_argument("--input-table", default="inventory_snapshots")
    parser.add_argument("--decisions-table", default="price_decisions")
    parser.add_argument("--published-table", default="published_prices")
    parser.add_argument("--replace-output", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Row limit for DB backends. 0 = no limit.")

    # Model / config
    parser.add_argument("--model-path", default="")
    parser.add_argument("--metadata-path", default="")
    parser.add_argument("--schema-path", default="configs/feature_schema_v1.json")
    parser.add_argument("--rules-path", default="configs/pricing_rules_v1.json")
    parser.add_argument("--serving-config", default="configs/serving_config_v1.json")

    args = parser.parse_args()

    serving_config = None
    cfg_path = Path(args.serving_config)
    if cfg_path.exists():
        serving_config = load_json(cfg_path)

    model_path, metadata_path = _resolve_model_paths(
        model_path_arg=args.model_path.strip() or None,
        metadata_path_arg=args.metadata_path.strip() or None,
        serving_config=serving_config,
    )

    schema = load_schema(args.schema_path)
    pricing_rules = load_pricing_rules(args.rules_path)
    engine = PriceEngine.from_artifacts(
        model_path=model_path,
        metadata_path=metadata_path,
        schema_path=args.schema_path,
        rules_path=args.rules_path,
    )

    postgres_mode = args.backend == "postgres"
    source_batch_id = getattr(args, "source_batch_id", "").strip() or None

    # Read input
    if args.backend == "csv":
        raw_df = _read_csv_input(args)
    elif args.backend == "sqlite":
        if args.replace_output:
            conn = get_connection(args.db_path)
            try:
                initialize_schema(conn)
                clear_table(conn, "price_decisions")
                clear_table(conn, "published_prices")
            finally:
                conn.close()
        raw_df = _read_sqlite_input(args)
    else:
        postgres_engine = create_postgres_engine(args.database_url.strip())
        ensure_postgres_pricing_stack(postgres_engine)
        if args.replace_output:
            truncate_tables(postgres_engine, [args.decisions_table, args.published_table])
        raw_df = _read_postgres_input(args, source_batch_id)

    prepared_df = prepare_model_dataframe(raw_df, schema, include_target=False)
    updated_at = datetime.now(timezone.utc).isoformat()

    decision_rows, published_rows, counters = _run_decision_loop(
        raw_df=raw_df,
        prepared_df=prepared_df,
        engine=engine,
        pricing_rules=pricing_rules,
        serving_config=serving_config,
        args=args,
        updated_at=updated_at,
        source_batch_id=source_batch_id,
        postgres_mode=postgres_mode,
    )

    decisions_df = pd.DataFrame(decision_rows)
    published_df = pd.DataFrame(published_rows)

    # Write output
    if args.backend == "csv":
        _write_csv_output(args, decisions_df, published_df)
    elif args.backend == "sqlite":
        _write_sqlite_output(args, decisions_df, published_df)
    else:
        _write_postgres_output(args, decisions_df, published_df)

    print(f"Resolved model path: {model_path}")
    print(f"Processed rows this run: {len(raw_df)}")
    print("Status counts:", counters)


if __name__ == "__main__":
    main()
