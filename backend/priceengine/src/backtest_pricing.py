import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# Allow running this file as a script from project root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features import load_schema, prepare_model_dataframe  # noqa: E402
from src.price_engine import PriceEngine  # noqa: E402


def build_cancellation_lookup(raw_df: pd.DataFrame) -> tuple[dict[tuple[int, str], float], float]:
    booked = raw_df[raw_df["booking_made"] == 1].copy()
    if booked.empty:
        return {}, 0.0

    booked["lead_bucket"] = pd.cut(
        booked["lead_time"],
        bins=[-1, 7, 14, 30, 60, 9999],
        labels=["0_7", "8_14", "15_30", "31_60", "61_plus"],
        include_lowest=True,
    ).astype(str)

    grouped = booked.groupby(["refundable_rate_flag", "lead_bucket"], as_index=False)["cancellation"].mean()
    lookup: dict[tuple[int, str], float] = {}
    for _, row in grouped.iterrows():
        key = (int(row["refundable_rate_flag"]), str(row["lead_bucket"]))
        lookup[key] = float(row["cancellation"])

    default_rate = float(booked["cancellation"].mean())
    return lookup, default_rate


def get_cancellation_rate(
    row: pd.Series,
    lookup: dict[tuple[int, str], float],
    default_rate: float,
) -> float:
    lead = float(row["lead_time"])
    if lead <= 7:
        bucket = "0_7"
    elif lead <= 14:
        bucket = "8_14"
    elif lead <= 30:
        bucket = "15_30"
    elif lead <= 60:
        bucket = "31_60"
    else:
        bucket = "61_plus"
    key = (int(row.get("refundable_rate_flag", 0)), bucket)
    return float(lookup.get(key, default_rate))


def _safe_float(value: Any, fallback: float) -> float:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return fallback
    try:
        return float(value)
    except Exception:  # noqa: BLE001
        return fallback


def create_plots(
    by_hotel_df: pd.DataFrame,
    row_results_df: pd.DataFrame,
    outputs_dir: Path,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Revenue uplift by hotel.
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(
        by_hotel_df["hotel_id"].astype(str),
        by_hotel_df["net_revenue_uplift_pct"],
        color="#2a9d8f",
    )
    ax.set_title("Net Expected Revenue Uplift by Hotel (%)")
    ax.set_xlabel("Hotel ID")
    ax.set_ylabel("Uplift %")
    ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    fig.savefig(outputs_dir / "backtest_net_revenue_uplift_by_hotel.png", dpi=150)
    plt.close(fig)

    # Price delta distribution.
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(row_results_df["price_delta_pct"], bins=40, color="#264653", alpha=0.85)
    ax.set_title("Distribution of Dynamic vs Baseline Price Delta (%)")
    ax.set_xlabel("Price Delta %")
    ax.set_ylabel("Rows")
    ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    fig.savefig(outputs_dir / "backtest_price_delta_distribution.png", dpi=150)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest dynamic pricing against static baseline.")
    parser.add_argument("--input-csv", default="synthetic_hotel_pricing.csv")
    parser.add_argument("--schema-path", default="configs/feature_schema_v1.json")
    parser.add_argument("--rules-path", default="configs/pricing_rules_v1.json")
    parser.add_argument("--model-path", default="artifacts/champion_model.pkl")
    parser.add_argument("--metadata-path", default="artifacts/champion_model_metadata.json")
    parser.add_argument("--outputs-dir", default="outputs")
    parser.add_argument(
        "--baseline-price-source",
        default="base_price",
        choices=["base_price", "offered_price"],
        help="Static baseline price source.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="Optional row cap for faster experimentation. 0 means all rows.",
    )
    parser.add_argument(
        "--save-row-level",
        action="store_true",
        help="Save row-level backtest outputs (large file).",
    )
    args = parser.parse_args()

    outputs_dir = Path(args.outputs_dir)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    model_path = Path(args.model_path)
    metadata_path = Path(args.metadata_path)
    if not model_path.exists():
        model_path = Path("artifacts/logistic_regression.pkl")
        metadata_path = Path("artifacts/logistic_regression_metadata.json")

    schema = load_schema(args.schema_path)
    raw_df = pd.read_csv(args.input_csv)
    if args.max_rows and args.max_rows > 0:
        raw_df = raw_df.head(args.max_rows).copy()

    prepared_df = prepare_model_dataframe(raw_df, schema, include_target=False)
    engine = PriceEngine.from_artifacts(
        model_path=model_path,
        metadata_path=metadata_path if metadata_path.exists() else None,
        schema_path=args.schema_path,
        rules_path=args.rules_path,
    )

    cancellation_lookup, default_cancel_rate = build_cancellation_lookup(raw_df)

    row_results: list[dict[str, Any]] = []
    total_rows = len(raw_df)
    for idx, prepared_row in prepared_df.iterrows():
        raw_row = raw_df.iloc[idx]
        previous_price = _safe_float(raw_row.get("offered_price"), float(prepared_row["base_price"]))

        dynamic = engine.recommend_from_prepared_row(
            prepared_row=prepared_row,
            previous_price=previous_price,
            manual_override_price=None,
        )
        dynamic_price = float(dynamic["final_price"])
        dynamic_prob = float(dynamic["predicted_probability"])
        dynamic_exp_rev = float(dynamic["expected_revenue"])

        baseline_price = _safe_float(raw_row.get(args.baseline_price_source), float(prepared_row["base_price"]))
        baseline_prob, baseline_exp_rev = engine.score_single_price(
            prepared_row=prepared_row,
            offered_price=baseline_price,
        )

        cancel_rate = get_cancellation_rate(raw_row, cancellation_lookup, default_cancel_rate)
        dynamic_net_rev = dynamic_exp_rev * (1.0 - cancel_rate)
        baseline_net_rev = baseline_exp_rev * (1.0 - cancel_rate)

        price_delta_pct = ((dynamic_price / baseline_price) - 1.0) * 100.0 if baseline_price > 0 else 0.0

        row_results.append(
            {
                "hotel_id": int(raw_row["hotel_id"]),
                "room_type_id": int(raw_row["room_type_id"]),
                "stay_date": str(raw_row["stay_date"]),
                "snapshot_date": str(raw_row["snapshot_date"]),
                "baseline_price": baseline_price,
                "dynamic_price": dynamic_price,
                "baseline_prob": float(baseline_prob),
                "dynamic_prob": dynamic_prob,
                "baseline_expected_revenue": float(baseline_exp_rev),
                "dynamic_expected_revenue": dynamic_exp_rev,
                "baseline_net_expected_revenue": float(baseline_net_rev),
                "dynamic_net_expected_revenue": dynamic_net_rev,
                "estimated_cancellation_rate": cancel_rate,
                "price_delta_pct": price_delta_pct,
                "rules_applied": "|".join(dynamic["applied_rules"]),
            }
        )

        if (idx + 1) % 20000 == 0:
            print(f"Processed {idx + 1}/{total_rows} rows...")

    row_df = pd.DataFrame(row_results)

    baseline_rev = float(row_df["baseline_expected_revenue"].sum())
    dynamic_rev = float(row_df["dynamic_expected_revenue"].sum())
    baseline_net = float(row_df["baseline_net_expected_revenue"].sum())
    dynamic_net = float(row_df["dynamic_net_expected_revenue"].sum())
    baseline_bookings = float(row_df["baseline_prob"].sum())
    dynamic_bookings = float(row_df["dynamic_prob"].sum())

    summary = {
        "rows_evaluated": int(len(row_df)),
        "baseline_price_source": args.baseline_price_source,
        "model_version": engine.model_version,
        "expected_revenue": {
            "baseline_total": baseline_rev,
            "dynamic_total": dynamic_rev,
            "uplift_pct": ((dynamic_rev - baseline_rev) / baseline_rev * 100.0) if baseline_rev > 0 else 0.0,
        },
        "net_expected_revenue_after_cancellation_proxy": {
            "baseline_total": baseline_net,
            "dynamic_total": dynamic_net,
            "uplift_pct": ((dynamic_net - baseline_net) / baseline_net * 100.0) if baseline_net > 0 else 0.0,
        },
        "expected_bookings": {
            "baseline_total": baseline_bookings,
            "dynamic_total": dynamic_bookings,
            "uplift_pct": ((dynamic_bookings - baseline_bookings) / baseline_bookings * 100.0)
            if baseline_bookings > 0
            else 0.0,
        },
        "avg_price_delta_pct": float(row_df["price_delta_pct"].mean()),
        "rule_hit_rate_pct": float((row_df["rules_applied"] != "").mean() * 100.0),
    }

    by_hotel = row_df.groupby("hotel_id", as_index=False).agg(
        rows=("hotel_id", "size"),
        baseline_expected_revenue=("baseline_expected_revenue", "sum"),
        dynamic_expected_revenue=("dynamic_expected_revenue", "sum"),
        baseline_net_expected_revenue=("baseline_net_expected_revenue", "sum"),
        dynamic_net_expected_revenue=("dynamic_net_expected_revenue", "sum"),
        baseline_expected_bookings=("baseline_prob", "sum"),
        dynamic_expected_bookings=("dynamic_prob", "sum"),
        avg_price_delta_pct=("price_delta_pct", "mean"),
        rule_hit_rate_pct=("rules_applied", lambda x: float((x != "").mean() * 100.0)),
    )
    by_hotel["revenue_uplift_pct"] = (
        (by_hotel["dynamic_expected_revenue"] - by_hotel["baseline_expected_revenue"])
        / by_hotel["baseline_expected_revenue"]
        * 100.0
    )
    by_hotel["net_revenue_uplift_pct"] = (
        (by_hotel["dynamic_net_expected_revenue"] - by_hotel["baseline_net_expected_revenue"])
        / by_hotel["baseline_net_expected_revenue"]
        * 100.0
    )
    by_hotel["bookings_uplift_pct"] = (
        (by_hotel["dynamic_expected_bookings"] - by_hotel["baseline_expected_bookings"])
        / by_hotel["baseline_expected_bookings"]
        * 100.0
    )

    summary_path = outputs_dir / "backtest_summary.json"
    by_hotel_path = outputs_dir / "backtest_by_hotel.csv"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    by_hotel.to_csv(by_hotel_path, index=False)

    if args.save_row_level:
        row_df.to_csv(outputs_dir / "backtest_row_level.csv", index=False)

    create_plots(by_hotel_df=by_hotel, row_results_df=row_df, outputs_dir=outputs_dir)

    print("Backtest complete.")
    print(f"Summary: {summary_path}")
    print(f"By-hotel: {by_hotel_path}")
    if args.save_row_level:
        print(f"Row-level: {outputs_dir / 'backtest_row_level.csv'}")
    print(f"Revenue uplift (%): {summary['expected_revenue']['uplift_pct']:.3f}")
    print(f"Net revenue uplift (%): {summary['net_expected_revenue_after_cancellation_proxy']['uplift_pct']:.3f}")
    print(f"Expected bookings uplift (%): {summary['expected_bookings']['uplift_pct']:.3f}")


if __name__ == "__main__":
    main()
