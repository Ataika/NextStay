import json
import pickle
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.pipeline import Pipeline

# Allow running this file as a script from project root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.candidates import generate_candidate_prices  # noqa: E402
from src.features import get_model_feature_columns, load_schema, prepare_model_dataframe  # noqa: E402
from src.optimizer import score_candidate_prices, select_best_candidate  # noqa: E402
from src.rules import apply_business_rules  # noqa: E402


def load_pricing_rules(rules_path: str | Path) -> dict[str, Any]:
    with open(rules_path, encoding="utf-8") as handle:
        return json.load(handle)


class PriceEngine:
    """
    Dynamic pricing engine:
    context -> candidate generation -> model scoring -> optimizer -> business rules.
    """

    def __init__(
        self,
        model_pipeline: Pipeline,
        schema: dict[str, Any],
        pricing_rules: dict[str, Any],
        model_version: str,
    ) -> None:
        self.model_pipeline = model_pipeline
        self.schema = schema
        self.pricing_rules = pricing_rules
        self.feature_columns = get_model_feature_columns(schema)
        self.model_version = model_version

    @classmethod
    def from_artifacts(
        cls,
        model_path: str | Path,
        schema_path: str | Path = "configs/feature_schema_v1.json",
        rules_path: str | Path = "configs/pricing_rules_v1.json",
        metadata_path: str | Path | None = "artifacts/global_booking_model_v1_metadata.json",
    ) -> "PriceEngine":
        schema = load_schema(schema_path)
        pricing_rules = load_pricing_rules(rules_path)

        with open(model_path, "rb") as handle:
            model_pipeline = pickle.load(handle)

        model_version = Path(model_path).stem
        if metadata_path is not None and Path(metadata_path).exists():
            with open(metadata_path, encoding="utf-8") as handle:
                metadata = json.load(handle)
                model_version = metadata.get("model_name", model_version)

        return cls(
            model_pipeline=model_pipeline,
            schema=schema,
            pricing_rules=pricing_rules,
            model_version=model_version,
        )

    def _prepare_single_context(self, context: dict[str, Any]) -> pd.Series:
        raw_df = pd.DataFrame([context])
        prepared_df = prepare_model_dataframe(raw_df, self.schema, include_target=False)
        return prepared_df.iloc[0]

    def score_single_price(self, prepared_row: pd.Series, offered_price: float) -> tuple[float, float]:
        context_df = pd.DataFrame([prepared_row.to_dict()])
        context_df["offered_price"] = float(offered_price)
        probability = float(self.model_pipeline.predict_proba(context_df[self.feature_columns])[:, 1][0])
        expected_revenue = float(offered_price * probability)
        return probability, expected_revenue

    def score_price(self, context: dict[str, Any], offered_price: float) -> tuple[float, float]:
        prepared_row = self._prepare_single_context(context)
        return self.score_single_price(prepared_row=prepared_row, offered_price=offered_price)

    def recommend_from_prepared_row(
        self,
        prepared_row: pd.Series,
        previous_price: float | None = None,
        manual_override_price: float | None = None,
    ) -> dict[str, Any]:
        hotel_segment = str(prepared_row["hotel_segment"])
        base_price = float(prepared_row["base_price"])

        current_price = None
        if "offered_price" in prepared_row and pd.notna(prepared_row["offered_price"]):
            current_price = float(prepared_row["offered_price"])

        candidate_prices = generate_candidate_prices(
            base_price=base_price,
            hotel_segment=hotel_segment,
            pricing_rules=self.pricing_rules,
            current_price=current_price,
        )

        scored_candidates = score_candidate_prices(
            model_pipeline=self.model_pipeline,
            base_context_row=prepared_row,
            feature_columns=self.feature_columns,
            candidate_prices=candidate_prices,
        )
        best = select_best_candidate(scored_candidates)

        final_price, applied_rules = apply_business_rules(
            candidate_price=best["optimized_price"],
            hotel_segment=hotel_segment,
            base_price=base_price,
            is_weekend=int(prepared_row.get("is_weekend", 0)),
            is_holiday=int(prepared_row.get("is_holiday", 0)),
            pricing_rules=self.pricing_rules,
            previous_price=previous_price,
            manual_override_price=manual_override_price,
        )

        final_probability = best["optimized_probability"]
        final_expected_revenue = best["optimized_expected_revenue"]
        if final_price != best["optimized_price"]:
            final_probability, final_expected_revenue = self.score_single_price(
                prepared_row=prepared_row,
                offered_price=final_price,
            )

        top_candidates = scored_candidates.sort_values("expected_revenue", ascending=False).head(3)
        top_candidates_list = top_candidates.to_dict(orient="records")

        return {
            "model_version": self.model_version,
            "rules_version": self.pricing_rules.get("rules_version", "unknown"),
            "hotel_segment": hotel_segment,
            "optimized_price": round(best["optimized_price"], 2),
            "optimized_probability": float(best["optimized_probability"]),
            "optimized_expected_revenue": float(best["optimized_expected_revenue"]),
            "final_price": round(final_price, 2),
            "predicted_probability": float(final_probability),
            "expected_revenue": float(final_expected_revenue),
            "applied_rules": applied_rules,
            "candidate_count": int(len(candidate_prices)),
            "top_candidates": top_candidates_list,
        }

    def recommend_price(
        self,
        context: dict[str, Any],
        previous_price: float | None = None,
        manual_override_price: float | None = None,
    ) -> dict[str, Any]:
        prepared_row = self._prepare_single_context(context)
        return self.recommend_from_prepared_row(
            prepared_row=prepared_row,
            previous_price=previous_price,
            manual_override_price=manual_override_price,
        )
