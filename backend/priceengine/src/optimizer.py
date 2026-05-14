import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline


def score_candidate_prices(
    model_pipeline: Pipeline,
    base_context_row: pd.Series,
    feature_columns: list[str],
    candidate_prices: list[float],
) -> pd.DataFrame:
    """
    Score multiple candidate prices for one booking context.
    Returns price, probability and expected revenue per candidate.
    """
    if not candidate_prices:
        raise ValueError("candidate_prices is empty.")

    candidate_contexts = pd.DataFrame([base_context_row.to_dict()] * len(candidate_prices))
    candidate_contexts["offered_price"] = np.array(candidate_prices, dtype=float)

    probabilities = model_pipeline.predict_proba(candidate_contexts[feature_columns])[:, 1]
    expected_revenue = candidate_contexts["offered_price"].to_numpy() * probabilities

    scored = pd.DataFrame(
        {
            "candidate_price": candidate_contexts["offered_price"].to_numpy(),
            "predicted_probability": probabilities,
            "expected_revenue": expected_revenue,
        }
    )
    return scored.sort_values("candidate_price").reset_index(drop=True)


def select_best_candidate(scored_candidates: pd.DataFrame) -> dict[str, float]:
    """Pick the candidate with maximum expected revenue."""
    if scored_candidates.empty:
        raise ValueError("scored_candidates is empty.")
    best_idx = scored_candidates["expected_revenue"].idxmax()
    best_row = scored_candidates.loc[best_idx]
    return {
        "optimized_price": float(best_row["candidate_price"]),
        "optimized_probability": float(best_row["predicted_probability"]),
        "optimized_expected_revenue": float(best_row["expected_revenue"]),
    }
