import argparse
import json
import os
import pickle
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.pipeline import Pipeline

# Use a writable matplotlib config/cache in the system temp dir (container-safe).
_mpl_cache = Path(tempfile.gettempdir()) / "nextstay_mplconfig"
_mpl_cache.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(_mpl_cache))

import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

# Allow running this file as a script from project root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.features import (  # noqa: E402
    get_model_feature_columns,
    load_schema,
    prepare_model_dataframe,
)
from src.ml_utils import compute_metrics, time_based_split  # noqa: E402
from src.preprocessing import build_preprocessor  # noqa: E402

SEED = 42


def evaluate_by_hotel(
    model: Pipeline,
    df: pd.DataFrame,
    feature_columns: list[str],
    target_column: str,
    model_name: str,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for hotel_id, group in df.groupby("hotel_id"):
        probs = model.predict_proba(group[feature_columns])[:, 1]
        metrics = compute_metrics(group[target_column], probs)
        rows.append(
            {
                "model_name": model_name,
                "hotel_id": int(hotel_id),
                "rows": int(len(group)),
                "bookings": int(group[target_column].sum()),
                **metrics,
            }
        )
    return pd.DataFrame(rows).sort_values(["model_name", "hotel_id"])


def get_model_registry() -> dict[str, Any]:
    """
    Baseline + 2 additional models:
    1) logistic_regression (existing baseline)
    2) random_forest
    3) extra_trees
    """
    return {
        "logistic_regression": LogisticRegression(
            max_iter=3000,
            solver="lbfgs",
            random_state=SEED,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=250,
            min_samples_leaf=2,
            n_jobs=-1,
            random_state=SEED,
        ),
        "extra_trees": ExtraTreesClassifier(
            n_estimators=300,
            min_samples_leaf=2,
            n_jobs=-1,
            random_state=SEED,
        ),
    }


def save_model_artifact(
    pipeline: Pipeline,
    model_name: str,
    schema_version: str,
    metrics: dict[str, Any],
    feature_columns: list[str],
    artifacts_dir: Path,
) -> None:
    model_path = artifacts_dir / f"{model_name}.pkl"
    metadata_path = artifacts_dir / f"{model_name}_metadata.json"

    with open(model_path, "wb") as handle:
        pickle.dump(pipeline, handle)

    metadata = {
        "model_name": model_name,
        "schema_version": schema_version,
        "trained_at_utc": datetime.utcnow().isoformat(),
        "feature_columns": feature_columns,
        "metrics": metrics,
    }
    with open(metadata_path, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2, default=str)


def create_metrics_plot(test_metrics_df: pd.DataFrame, output_path: Path) -> None:
    order = test_metrics_df.sort_values("log_loss")["model_name"].tolist()
    plot_df = test_metrics_df.set_index("model_name").loc[order].reset_index()

    fig, axes = plt.subplots(1, 3, figsize=(14, 4))

    axes[0].bar(plot_df["model_name"], plot_df["roc_auc"], color="#2a9d8f")
    axes[0].set_title("Test ROC-AUC (Higher is better)")
    axes[0].set_ylabel("ROC-AUC")
    axes[0].tick_params(axis="x", rotation=20)

    axes[1].bar(plot_df["model_name"], plot_df["log_loss"], color="#e76f51")
    axes[1].set_title("Test Log Loss (Lower is better)")
    axes[1].set_ylabel("Log Loss")
    axes[1].tick_params(axis="x", rotation=20)

    axes[2].bar(plot_df["model_name"], plot_df["brier_score"], color="#264653")
    axes[2].set_title("Test Brier Score (Lower is better)")
    axes[2].set_ylabel("Brier Score")
    axes[2].tick_params(axis="x", rotation=20)

    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def create_roc_plot(
    y_true: pd.Series,
    predictions: dict[str, np.ndarray],
    output_path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(7, 6))
    for model_name, probs in predictions.items():
        fpr, tpr, _ = roc_curve(y_true, probs)
        auc_value = roc_auc_score(y_true, probs)
        ax.plot(fpr, tpr, label=f"{model_name} (AUC={auc_value:.3f})")

    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", linewidth=1)
    ax.set_title("Test ROC Curves")
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.legend()
    ax.grid(alpha=0.2)

    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def create_calibration_plot(
    y_true: pd.Series,
    predictions: dict[str, np.ndarray],
    output_path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(7, 6))
    for model_name, probs in predictions.items():
        frac_pos, mean_pred = calibration_curve(y_true, probs, n_bins=10, strategy="quantile")
        ax.plot(mean_pred, frac_pos, marker="o", label=model_name)

    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", linewidth=1, label="Perfect calibration")
    ax.set_title("Test Calibration Curves")
    ax.set_xlabel("Mean Predicted Probability")
    ax.set_ylabel("Observed Positive Fraction")
    ax.legend()
    ax.grid(alpha=0.2)

    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train and compare multiple booking-probability models with visual outputs."
    )
    parser.add_argument("--input-csv", default="synthetic_hotel_pricing.csv")
    parser.add_argument("--schema-path", default="configs/feature_schema_v1.json")
    parser.add_argument("--artifacts-dir", default="artifacts")
    parser.add_argument("--outputs-dir", default="outputs")
    parser.add_argument("--train-fraction", type=float, default=0.70)
    parser.add_argument("--validation-fraction", type=float, default=0.15)
    args = parser.parse_args()

    artifacts_dir = Path(args.artifacts_dir)
    outputs_dir = Path(args.outputs_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    schema = load_schema(args.schema_path)
    raw_df = pd.read_csv(args.input_csv)
    df = prepare_model_dataframe(raw_df, schema, include_target=True)
    feature_columns = get_model_feature_columns(schema)
    target_column = schema["target_column"]

    train_df, validation_df, test_df = time_based_split(
        df,
        date_column="stay_date",
        train_fraction=args.train_fraction,
        validation_fraction=args.validation_fraction,
    )

    model_registry = get_model_registry()
    all_metrics_rows: list[dict[str, Any]] = []
    by_hotel_results: list[pd.DataFrame] = []
    test_predictions: dict[str, np.ndarray] = {}

    for model_name, estimator in model_registry.items():
        preprocessor = build_preprocessor(schema)
        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("model", estimator),
            ]
        )

        fit_start = time.time()
        pipeline.fit(train_df[feature_columns], train_df[target_column])
        fit_seconds = time.time() - fit_start

        score_start = time.time()
        validation_probs = pipeline.predict_proba(validation_df[feature_columns])[:, 1]
        test_probs = pipeline.predict_proba(test_df[feature_columns])[:, 1]
        score_seconds = time.time() - score_start

        validation_metrics = compute_metrics(validation_df[target_column], validation_probs)
        test_metrics = compute_metrics(test_df[target_column], test_probs)

        all_metrics_rows.append(
            {
                "model_name": model_name,
                "split": "validation",
                **validation_metrics,
                "fit_seconds": round(fit_seconds, 3),
                "score_seconds": round(score_seconds, 3),
            }
        )
        all_metrics_rows.append(
            {
                "model_name": model_name,
                "split": "test",
                **test_metrics,
                "fit_seconds": round(fit_seconds, 3),
                "score_seconds": round(score_seconds, 3),
            }
        )

        by_hotel_df = evaluate_by_hotel(
            model=pipeline,
            df=test_df,
            feature_columns=feature_columns,
            target_column=target_column,
            model_name=model_name,
        )
        by_hotel_results.append(by_hotel_df)

        test_predictions[model_name] = test_probs

        save_model_artifact(
            pipeline=pipeline,
            model_name=model_name,
            schema_version=schema["schema_version"],
            metrics={"validation": validation_metrics, "test": test_metrics},
            feature_columns=feature_columns,
            artifacts_dir=artifacts_dir,
        )

    overall_metrics_df = pd.DataFrame(all_metrics_rows)
    overall_metrics_df.to_csv(outputs_dir / "model_comparison_overall_metrics.csv", index=False)

    by_hotel_metrics_df = pd.concat(by_hotel_results, ignore_index=True)
    by_hotel_metrics_df.to_csv(outputs_dir / "model_comparison_test_metrics_by_hotel.csv", index=False)

    test_only_df = overall_metrics_df[overall_metrics_df["split"] == "test"].copy()
    test_only_df["rank_log_loss"] = test_only_df["log_loss"].rank(method="min", ascending=True)
    test_only_df["rank_brier"] = test_only_df["brier_score"].rank(method="min", ascending=True)
    test_only_df["rank_roc_auc"] = test_only_df["roc_auc"].rank(method="min", ascending=False)
    test_only_df["rank_mean"] = (
        test_only_df["rank_log_loss"] + test_only_df["rank_brier"] + test_only_df["rank_roc_auc"]
    ) / 3.0
    test_only_df.to_csv(outputs_dir / "model_comparison_test_rankings.csv", index=False)

    # Balanced winner criterion across calibration and ranking quality.
    winner_row = test_only_df.sort_values(
        ["rank_mean", "log_loss", "brier_score", "roc_auc"],
        ascending=[True, True, True, False],
    ).iloc[0]
    winner_summary = {
        "winner_model": winner_row["model_name"],
        "selection_metric": "best_average_rank_across_log_loss_brier_roc_auc",
        "winner_test_metrics": {
            "log_loss": float(winner_row["log_loss"]),
            "brier_score": float(winner_row["brier_score"]),
            "roc_auc": float(winner_row["roc_auc"]),
        },
        "winner_ranks": {
            "rank_log_loss": float(winner_row["rank_log_loss"]),
            "rank_brier": float(winner_row["rank_brier"]),
            "rank_roc_auc": float(winner_row["rank_roc_auc"]),
            "rank_mean": float(winner_row["rank_mean"]),
        },
        "compared_models": sorted(model_registry.keys()),
    }
    with open(outputs_dir / "model_comparison_winner.json", "w", encoding="utf-8") as handle:
        json.dump(winner_summary, handle, indent=2)

    create_metrics_plot(
        test_metrics_df=test_only_df,
        output_path=outputs_dir / "model_comparison_test_metrics.png",
    )
    create_roc_plot(
        y_true=test_df[target_column],
        predictions=test_predictions,
        output_path=outputs_dir / "model_comparison_test_roc_curve.png",
    )
    create_calibration_plot(
        y_true=test_df[target_column],
        predictions=test_predictions,
        output_path=outputs_dir / "model_comparison_test_calibration.png",
    )

    print("Model comparison completed.")
    print("Winner:", winner_summary["winner_model"])
    print("Saved outputs:")
    print(f"- {outputs_dir / 'model_comparison_overall_metrics.csv'}")
    print(f"- {outputs_dir / 'model_comparison_test_metrics_by_hotel.csv'}")
    print(f"- {outputs_dir / 'model_comparison_test_rankings.csv'}")
    print(f"- {outputs_dir / 'model_comparison_winner.json'}")
    print(f"- {outputs_dir / 'model_comparison_test_metrics.png'}")
    print(f"- {outputs_dir / 'model_comparison_test_roc_curve.png'}")
    print(f"- {outputs_dir / 'model_comparison_test_calibration.png'}")


if __name__ == "__main__":
    main()
