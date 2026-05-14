import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score


def time_based_split(
    df: pd.DataFrame,
    date_column: str,
    train_fraction: float = 0.70,
    validation_fraction: float = 0.15,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split by stay_date to avoid future leakage into training."""
    unique_dates = pd.Series(df[date_column].dropna().unique()).sort_values().to_numpy()
    if len(unique_dates) < 3:
        raise ValueError("Need at least 3 unique dates for train/validation/test split.")

    train_end = max(1, int(len(unique_dates) * train_fraction))
    validation_end = max(train_end + 1, int(len(unique_dates) * (train_fraction + validation_fraction)))
    validation_end = min(validation_end, len(unique_dates) - 1)

    train_dates = set(unique_dates[:train_end])
    validation_dates = set(unique_dates[train_end:validation_end])

    train_df = df[df[date_column].isin(train_dates)].copy()
    validation_df = df[df[date_column].isin(validation_dates)].copy()
    test_df = df[~df[date_column].isin(train_dates | validation_dates)].copy()
    return train_df, validation_df, test_df


def compute_metrics(y_true: pd.Series, y_prob: np.ndarray) -> dict[str, float]:
    """Binary classification metrics for booking probability models."""
    y_true_array = y_true.to_numpy()
    metrics: dict[str, float] = {
        "log_loss": float(log_loss(y_true_array, y_prob, labels=[0, 1])),
        "brier_score": float(brier_score_loss(y_true_array, y_prob)),
    }
    if len(np.unique(y_true_array)) >= 2:
        metrics["roc_auc"] = float(roc_auc_score(y_true_array, y_prob))
    else:
        metrics["roc_auc"] = float("nan")
    return metrics
