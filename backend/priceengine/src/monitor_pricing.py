import argparse
import json
import sys
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features import load_schema  # noqa: E402


def _parse_rule_adjustments(value: Any) -> list[str]:
    """Parse rule_adjustments supporting both JSON array and legacy pipe-string formats."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    s = str(value).strip()
    if not s:
        return []
    if s.startswith("["):
        try:
            return json.loads(s)
        except (json.JSONDecodeError, ValueError):
            pass
    return [p for p in s.split("|") if p]


def _safe_rate(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return float(numerator / denominator)


def _is_rule_hit(value: Any) -> bool:
    rules = _parse_rule_adjustments(value)
    return bool(rules) and rules not in [["rollout_skip_keep_price"], ["none"]]


def _psi(reference: pd.Series, current: pd.Series, bins: int = 10) -> float:
    ref = reference.dropna().to_numpy(dtype=float)
    cur = current.dropna().to_numpy(dtype=float)
    if len(ref) == 0 or len(cur) == 0:
        return 0.0
    if np.all(ref == ref[0]) and np.all(cur == cur[0]):
        return 0.0

    quantiles = np.linspace(0, 1, bins + 1)
    edges = np.unique(np.quantile(ref, quantiles))
    if len(edges) < 3:
        return 0.0

    ref_counts, _ = np.histogram(ref, bins=edges)
    cur_counts, _ = np.histogram(cur, bins=edges)

    ref_dist = np.clip(ref_counts / max(ref_counts.sum(), 1), 1e-6, 1.0)
    cur_dist = np.clip(cur_counts / max(cur_counts.sum(), 1), 1e-6, 1.0)
    psi_val = np.sum((cur_dist - ref_dist) * np.log(cur_dist / ref_dist))
    return float(psi_val)


def _drift_band(psi: float) -> str:
    if psi < 0.1:
        return "stable"
    if psi < 0.25:
        return "moderate_shift"
    return "major_shift"


def create_plots(
    by_hotel_df: pd.DataFrame,
    rule_usage_df: pd.DataFrame,
    outputs_dir: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(by_hotel_df["hotel_id"].astype(str), by_hotel_df["total_expected_revenue"], color="#2a9d8f")
    ax.set_title("Expected Revenue by Hotel")
    ax.set_xlabel("Hotel ID")
    ax.set_ylabel("Expected Revenue")
    ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    fig.savefig(outputs_dir / "monitor_expected_revenue_by_hotel.png", dpi=150)
    plt.close(fig)

    top_rules = rule_usage_df.sort_values("count", ascending=False).head(10)
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.bar(top_rules["rule"], top_rules["count"], color="#264653")
    ax.set_title("Top Rule Adjustments")
    ax.set_xlabel("Rule")
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=25)
    ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    fig.savefig(outputs_dir / "monitor_rule_adjustments.png", dpi=150)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate monitoring report for pricing decisions.")
    parser.add_argument("--decisions-csv", default="outputs/price_decisions.csv")
    parser.add_argument("--context-csv", default="")
    parser.add_argument("--reference-csv", default="")
    parser.add_argument("--outputs-dir", default="outputs")
    parser.add_argument("--schema-path", default="configs/feature_schema_v1.json")
    args = parser.parse_args()

    decisions_path = Path(args.decisions_csv)
    if not decisions_path.exists():
        raise FileNotFoundError(f"Decisions file not found: {decisions_path}")

    outputs_dir = Path(args.outputs_dir)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    schema = load_schema(args.schema_path) if Path(args.schema_path).exists() else {}
    numeric_drift_features: list[str] = schema.get("numeric_feature_columns", [])

    decisions_df = pd.read_csv(decisions_path)
    context_df = (
        pd.read_csv(args.context_csv) if args.context_csv and Path(args.context_csv).exists() else pd.DataFrame()
    )
    reference_df = (
        pd.read_csv(args.reference_csv) if args.reference_csv and Path(args.reference_csv).exists() else pd.DataFrame()
    )

    # Join context for drift and richer breakdowns.
    key_cols = ["hotel_id", "room_type_id", "stay_date", "snapshot_date"]
    if not context_df.empty and all(col in context_df.columns for col in key_cols):
        decisions_enriched = decisions_df.merge(
            context_df[key_cols + [c for c in context_df.columns if c not in key_cols]],
            on=key_cols,
            how="left",
            suffixes=("", "_ctx"),
        )
    else:
        decisions_enriched = decisions_df.copy()

    decisions_enriched["rule_hit"] = decisions_enriched["rule_adjustments"].apply(_is_rule_hit)
    decisions_enriched["is_fallback"] = decisions_enriched.get("inference_status", "").astype(str).eq("fallback")
    decisions_enriched["is_rollout"] = decisions_enriched.get("in_rollout", 1)

    total_rows = len(decisions_enriched)
    observed_bookings = decisions_enriched["booking_made"].dropna()
    observed_cancellations = decisions_enriched["cancellation"].dropna()
    observed_booked_rows = decisions_enriched[decisions_enriched["booking_made"] == 1]

    summary = {
        "rows": int(total_rows),
        "model_version_counts": decisions_enriched["model_version"].value_counts(dropna=False).to_dict(),
        "total_expected_revenue": float(decisions_enriched["expected_revenue"].sum()),
        "avg_expected_revenue": float(decisions_enriched["expected_revenue"].mean()),
        "avg_predicted_probability": float(decisions_enriched["predicted_probability"].mean()),
        "avg_final_price": float(decisions_enriched["offered_price"].mean()),
        "rollout_coverage_pct": float(decisions_enriched["is_rollout"].mean() * 100.0),
        "rule_hit_rate_pct": float(decisions_enriched["rule_hit"].mean() * 100.0),
        "fallback_rate_pct": float(decisions_enriched["is_fallback"].mean() * 100.0),
        "observed_booking_rate_pct": float(observed_bookings.mean() * 100.0) if not observed_bookings.empty else None,
        "observed_cancellation_rate_pct_over_all_rows": float(observed_cancellations.mean() * 100.0)
        if not observed_cancellations.empty
        else None,
        "observed_cancellation_rate_pct_over_bookings": float(observed_booked_rows["cancellation"].mean() * 100.0)
        if not observed_booked_rows.empty
        else None,
    }

    by_hotel_df = (
        decisions_enriched.groupby("hotel_id", as_index=False)
        .agg(
            rows=("hotel_id", "size"),
            total_expected_revenue=("expected_revenue", "sum"),
            avg_expected_revenue=("expected_revenue", "mean"),
            avg_predicted_probability=("predicted_probability", "mean"),
            avg_final_price=("offered_price", "mean"),
            rule_hit_rate_pct=("rule_hit", lambda x: float(x.mean() * 100.0)),
            fallback_rate_pct=("is_fallback", lambda x: float(x.mean() * 100.0)),
            rollout_coverage_pct=("is_rollout", lambda x: float(pd.Series(x).mean() * 100.0)),
            observed_booking_rate_pct=("booking_made", lambda x: float(pd.Series(x).dropna().mean() * 100.0)),
            observed_cancellation_rate_pct=("cancellation", lambda x: float(pd.Series(x).dropna().mean() * 100.0)),
        )
        .sort_values("hotel_id")
    )

    # Rule usage distribution.
    rule_counter: dict[str, int] = {}
    for raw in decisions_enriched["rule_adjustments"].fillna(""):
        parts = _parse_rule_adjustments(raw) or ["none"]
        for part in parts:
            rule_counter[part] = rule_counter.get(part, 0) + 1
    rule_usage_df = pd.DataFrame(
        [
            {"rule": key, "count": value, "share_pct": _safe_rate(value, total_rows) * 100.0}
            for key, value in rule_counter.items()
        ]
    ).sort_values("count", ascending=False)

    # Numeric drift comparison (driven by schema numeric_feature_columns).
    drift_rows = []
    if not reference_df.empty:
        for col in numeric_drift_features:
            current_col = col if col in decisions_enriched.columns else f"{col}_ctx"
            if col not in reference_df.columns or current_col not in decisions_enriched.columns:
                continue
            ref_series = pd.to_numeric(reference_df[col], errors="coerce")
            cur_series = pd.to_numeric(decisions_enriched[current_col], errors="coerce")
            psi_val = _psi(ref_series, cur_series, bins=10)
            drift_rows.append(
                {
                    "feature": col,
                    "reference_mean": float(ref_series.mean()),
                    "current_mean": float(cur_series.mean()),
                    "mean_delta_pct": (
                        float((cur_series.mean() - ref_series.mean()) / ref_series.mean() * 100.0)
                        if ref_series.mean() != 0
                        else 0.0
                    ),
                    "psi": psi_val,
                    "drift_band": _drift_band(psi_val),
                }
            )

    drift_df = pd.DataFrame(drift_rows).sort_values("psi", ascending=False) if drift_rows else pd.DataFrame()
    drift_summary = {
        "features_checked": int(len(drift_df)),
        "major_shift_features": int((drift_df["drift_band"] == "major_shift").sum()) if not drift_df.empty else 0,
        "moderate_shift_features": int((drift_df["drift_band"] == "moderate_shift").sum()) if not drift_df.empty else 0,
        "stable_features": int((drift_df["drift_band"] == "stable").sum()) if not drift_df.empty else 0,
    }
    summary["drift_summary"] = drift_summary

    summary_path = outputs_dir / "monitoring_summary.json"
    by_hotel_path = outputs_dir / "monitoring_by_hotel.csv"
    rule_usage_path = outputs_dir / "monitoring_rule_usage.csv"
    drift_path = outputs_dir / "monitoring_drift_numeric.csv"

    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    by_hotel_df.to_csv(by_hotel_path, index=False)
    rule_usage_df.to_csv(rule_usage_path, index=False)
    if not drift_df.empty:
        drift_df.to_csv(drift_path, index=False)
    else:
        pd.DataFrame(
            columns=["feature", "reference_mean", "current_mean", "mean_delta_pct", "psi", "drift_band"]
        ).to_csv(drift_path, index=False)

    create_plots(by_hotel_df=by_hotel_df, rule_usage_df=rule_usage_df, outputs_dir=outputs_dir)

    print("Monitoring report generated.")
    print(f"Summary: {summary_path}")
    print(f"By hotel: {by_hotel_path}")
    print(f"Rule usage: {rule_usage_path}")
    print(f"Drift numeric: {drift_path}")
    print(f"Expected revenue total: {summary['total_expected_revenue']:.2f}")
    print(f"Rule hit rate (%): {summary['rule_hit_rate_pct']:.2f}")
    print(f"Fallback rate (%): {summary['fallback_rate_pct']:.2f}")


if __name__ == "__main__":
    main()
