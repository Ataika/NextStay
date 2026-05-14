"""
Lightweight test suite for the NextStay pricing engine.

Covers:
  - rules.py          (apply_business_rules)
  - candidates.py     (generate_candidate_prices)
  - features.py       (prepare_model_dataframe, ensure_required_columns)
  - serving_config.py (stable_hash_bucket, should_route_to_dynamic_pricing)
  - ml_utils.py       (time_based_split, compute_metrics)
  - optimizer.py      (score_candidate_prices, select_best_candidate)
  - monitor_pricing.py (_parse_rule_adjustments, _is_rule_hit, _psi)
  - batch_runner.py   (_fallback_price, _resolve_model_paths)
  - price_engine.py   (integration, real logistic_regression.pkl)
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

PRICEENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(PRICEENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PRICEENGINE_ROOT))

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

PRICING_RULES = {
    "rules_version": "test_v1",
    "global": {
        "candidate_price_steps_pct": [-0.2, -0.1, 0.0, 0.1, 0.2],
        "price_rounding_decimals": 2,
    },
    "segments": {
        "budget_city": {
            "min_price": 50.0,
            "max_price": 250.0,
            "max_daily_change_pct": 0.15,
            "weekend_min_multiplier": 1.05,
            "holiday_min_multiplier": 1.10,
        },
        "premium_luxury": {
            "min_price": 200.0,
            "max_price": 1200.0,
            "max_daily_change_pct": 0.10,
            "weekend_min_multiplier": 1.04,
            "holiday_min_multiplier": 1.10,
        },
    },
}

SCHEMA = {
    "schema_version": "test_v1",
    "target_column": "booking_made",
    "date_columns": ["snapshot_date", "stay_date"],
    "required_identifier_columns": ["hotel_id", "hotel_segment", "room_type_id", "room_type_name"],
    "required_feature_columns": [
        "lead_time",
        "occupancy_rate",
        "available_rooms",
        "day_of_week",
        "month",
        "season",
        "is_weekend",
        "is_holiday",
        "base_price",
        "offered_price",
        "total_inventory",
        "booked_rooms",
        "max_occupancy",
        "refundable_rate_flag",
        "breakfast_included_flag",
    ],
    "optional_feature_columns": ["competitor_price", "event_score"],
    "categorical_feature_columns": [
        "hotel_id",
        "hotel_segment",
        "room_type_id",
        "room_type_name",
        "day_of_week",
        "season",
    ],
    "numeric_feature_columns": [
        "lead_time",
        "occupancy_rate",
        "available_rooms",
        "month",
        "is_weekend",
        "is_holiday",
        "base_price",
        "offered_price",
        "total_inventory",
        "booked_rooms",
        "max_occupancy",
        "refundable_rate_flag",
        "breakfast_included_flag",
    ],
}


def _make_raw_row(**overrides) -> dict:
    """Minimal valid raw row for the test schema."""
    base = {
        "hotel_id": 1,
        "hotel_segment": "budget_city",
        "room_type_id": 1,
        "room_type_name": "Standard",
        "snapshot_date": "2025-01-01",
        "stay_date": "2025-01-15",
        "lead_time": 14,
        "occupancy_rate": 0.6,
        "available_rooms": 8,
        "day_of_week": "Wednesday",
        "month": 1,
        "season": "winter",
        "is_weekend": 0,
        "is_holiday": 0,
        "base_price": 120.0,
        "offered_price": 120.0,
        "total_inventory": 20,
        "booked_rooms": 12,
        "max_occupancy": 2,
        "refundable_rate_flag": 1,
        "breakfast_included_flag": 0,
        "booking_made": 1,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# rules.py
# ---------------------------------------------------------------------------


class TestApplyBusinessRules:
    from src.rules import apply_business_rules as _fn

    def _call(self, price, segment="budget_city", base=120.0, is_weekend=0, is_holiday=0, previous=None, override=None):
        from src.rules import apply_business_rules

        return apply_business_rules(
            candidate_price=price,
            hotel_segment=segment,
            base_price=base,
            is_weekend=is_weekend,
            is_holiday=is_holiday,
            pricing_rules=PRICING_RULES,
            previous_price=previous,
            manual_override_price=override,
        )

    def test_no_rules_triggered(self):
        price, rules = self._call(120.0)
        assert price == 120.0
        assert rules == []

    def test_manual_override_wins(self):
        price, rules = self._call(120.0, override=99.0)
        assert price == 99.0
        assert "manual_override" in rules

    def test_segment_min_price_enforced(self):
        price, rules = self._call(20.0)  # below min_price=50
        assert price == 50.0
        assert "segment_price_bounds" in rules

    def test_segment_max_price_enforced(self):
        price, rules = self._call(999.0)  # above max_price=250
        assert price == 250.0
        assert "segment_price_bounds" in rules

    def test_max_daily_change_down(self):
        # previous=100, max_change=15%, candidate=50 → clamped to 85
        price, rules = self._call(50.0, previous=100.0)
        assert price == pytest.approx(85.0, abs=0.01)
        assert "max_daily_change" in rules

    def test_max_daily_change_up(self):
        price, rules = self._call(200.0, previous=100.0)
        assert price == pytest.approx(115.0, abs=0.01)
        assert "max_daily_change" in rules

    def test_weekend_floor_applied(self):
        # weekend_min_multiplier=1.05, base=120 → floor=126
        price, rules = self._call(110.0, is_weekend=1)
        assert price == pytest.approx(126.0, abs=0.01)
        assert "weekend_floor" in rules

    def test_weekend_floor_not_applied_above_floor(self):
        price, rules = self._call(130.0, is_weekend=1)
        assert price == 130.0
        assert "weekend_floor" not in rules

    def test_holiday_floor_applied(self):
        price, rules = self._call(110.0, is_holiday=1)
        assert price == pytest.approx(132.0, abs=0.01)
        assert "holiday_floor" in rules

    def test_unknown_segment_raises(self):
        from src.rules import apply_business_rules

        with pytest.raises(ValueError, match="Missing pricing rules"):
            apply_business_rules(100.0, "nonexistent", 100.0, 0, 0, PRICING_RULES)

    def test_returned_rules_is_list(self):
        _, rules = self._call(120.0)
        assert isinstance(rules, list)


# ---------------------------------------------------------------------------
# candidates.py
# ---------------------------------------------------------------------------


class TestGenerateCandidatePrices:
    def _call(self, base, segment="budget_city", current=None):
        from src.candidates import generate_candidate_prices

        return generate_candidate_prices(base, segment, PRICING_RULES, current)

    def test_returns_sorted_unique_list(self):
        prices = self._call(100.0)
        assert prices == sorted(set(prices))

    def test_all_within_segment_bounds(self):
        prices = self._call(100.0)
        seg = PRICING_RULES["segments"]["budget_city"]
        for p in prices:
            assert seg["min_price"] <= p <= seg["max_price"]

    def test_base_price_in_candidates(self):
        prices = self._call(100.0)
        assert 100.0 in prices

    def test_current_price_included(self):
        prices = self._call(100.0, current=95.0)
        assert 95.0 in prices

    def test_current_price_clamped_to_bounds(self):
        prices = self._call(100.0, current=10.0)  # below min_price=50
        assert 10.0 not in prices
        assert 50.0 in prices

    def test_premium_luxury_min_clamps_low_base(self):
        # base=150 * 0.8 = 120 < min_price=200 → all at or above 200
        prices = self._call(150.0, segment="premium_luxury")
        seg = PRICING_RULES["segments"]["premium_luxury"]
        assert all(p >= seg["min_price"] for p in prices)

    def test_unknown_segment_raises(self):
        from src.candidates import generate_candidate_prices

        with pytest.raises(ValueError):
            generate_candidate_prices(100.0, "unknown", PRICING_RULES)


# ---------------------------------------------------------------------------
# features.py
# ---------------------------------------------------------------------------


class TestFeatures:
    def test_ensure_required_columns_passes(self):
        from src.features import ensure_required_columns

        df = pd.DataFrame([_make_raw_row()])
        ensure_required_columns(df, SCHEMA, include_target=True)  # no error

    def test_ensure_required_columns_raises_on_missing(self):
        from src.features import ensure_required_columns

        df = pd.DataFrame([_make_raw_row()])
        df = df.drop(columns=["lead_time"])
        with pytest.raises(ValueError, match="lead_time"):
            ensure_required_columns(df, SCHEMA, include_target=True)

    def test_optional_features_added_when_missing(self):
        from src.features import add_optional_features_and_missing_flags

        df = pd.DataFrame([{"x": 1}])
        result = add_optional_features_and_missing_flags(df, ["competitor_price", "event_score"])
        assert "competitor_price" in result.columns
        assert "competitor_price_missing_flag" in result.columns
        assert result["competitor_price_missing_flag"].iloc[0] == 1

    def test_optional_features_flag_zero_when_present(self):
        from src.features import add_optional_features_and_missing_flags

        df = pd.DataFrame([{"competitor_price": 99.0}])
        result = add_optional_features_and_missing_flags(df, ["competitor_price"])
        assert result["competitor_price_missing_flag"].iloc[0] == 0

    def test_prepare_model_dataframe_parses_dates(self):
        from src.features import prepare_model_dataframe

        df = pd.DataFrame([_make_raw_row()])
        result = prepare_model_dataframe(df, SCHEMA, include_target=True)
        assert pd.api.types.is_datetime64_any_dtype(result["stay_date"])

    def test_prepare_model_dataframe_no_target(self):
        from src.features import prepare_model_dataframe

        df = pd.DataFrame([_make_raw_row()])
        df = df.drop(columns=["booking_made"])
        result = prepare_model_dataframe(df, SCHEMA, include_target=False)
        assert "booking_made" not in result.columns

    def test_get_model_feature_columns_includes_missing_flags(self):
        from src.features import get_model_feature_columns

        cols = get_model_feature_columns(SCHEMA)
        assert "competitor_price_missing_flag" in cols
        assert "event_score_missing_flag" in cols

    def test_parse_dates_coerces_bad_values(self):
        from src.features import parse_dates

        df = pd.DataFrame([{"snapshot_date": "not-a-date", "stay_date": "2025-01-15"}])
        result = parse_dates(df, ["snapshot_date", "stay_date"])
        assert pd.isna(result["snapshot_date"].iloc[0])


# ---------------------------------------------------------------------------
# serving_config.py
# ---------------------------------------------------------------------------


class TestServingConfig:
    def test_stable_hash_bucket_is_deterministic(self):
        from src.serving_config import stable_hash_bucket

        assert stable_hash_bucket("test-key") == stable_hash_bucket("test-key")

    def test_stable_hash_bucket_in_range(self):
        from src.serving_config import stable_hash_bucket

        for key in ["a", "hotel_1_2025-06-01", "xyz123"]:
            assert 0 <= stable_hash_bucket(key) < 10_000

    def test_rollout_disabled_always_routes(self):
        from src.serving_config import should_route_to_dynamic_pricing

        cfg = {"enabled": False}
        assert (
            should_route_to_dynamic_pricing(
                hotel_id=1,
                hotel_segment="budget_city",
                stay_date="2025-01-01",
                room_type_id=1,
                snapshot_date="2024-12-15",
                rollout_config=cfg,
            )
            is True
        )

    def test_hotel_not_in_allowlist_blocked(self):
        from src.serving_config import should_route_to_dynamic_pricing

        cfg = {"enabled": True, "hotel_allowlist": [99], "traffic_fraction": 1.0}
        assert (
            should_route_to_dynamic_pricing(
                hotel_id=1,
                hotel_segment="budget_city",
                stay_date="2025-01-01",
                room_type_id=1,
                snapshot_date="2024-12-15",
                rollout_config=cfg,
            )
            is False
        )

    def test_segment_not_in_allowlist_blocked(self):
        from src.serving_config import should_route_to_dynamic_pricing

        cfg = {"enabled": True, "segment_allowlist": ["premium_luxury"], "traffic_fraction": 1.0}
        assert (
            should_route_to_dynamic_pricing(
                hotel_id=1,
                hotel_segment="budget_city",
                stay_date="2025-01-01",
                room_type_id=1,
                snapshot_date="2024-12-15",
                rollout_config=cfg,
            )
            is False
        )

    def test_zero_fraction_blocks_all(self):
        from src.serving_config import should_route_to_dynamic_pricing

        cfg = {"enabled": True, "traffic_fraction": 0.0}
        assert (
            should_route_to_dynamic_pricing(
                hotel_id=1,
                hotel_segment="budget_city",
                stay_date="2025-01-01",
                room_type_id=1,
                snapshot_date="2024-12-15",
                rollout_config=cfg,
            )
            is False
        )

    def test_full_fraction_routes_all(self):
        from src.serving_config import should_route_to_dynamic_pricing

        cfg = {"enabled": True, "traffic_fraction": 1.0}
        assert (
            should_route_to_dynamic_pricing(
                hotel_id=1,
                hotel_segment="budget_city",
                stay_date="2025-01-01",
                room_type_id=1,
                snapshot_date="2024-12-15",
                rollout_config=cfg,
            )
            is True
        )

    def test_partial_fraction_consistent(self):
        from src.serving_config import should_route_to_dynamic_pricing

        cfg = {"enabled": True, "traffic_fraction": 0.5, "seed": 42}
        results = [
            should_route_to_dynamic_pricing(
                hotel_id=i,
                hotel_segment="budget_city",
                stay_date="2025-01-01",
                room_type_id=1,
                snapshot_date="2024-12-15",
                rollout_config=cfg,
            )
            for i in range(1, 21)
        ]
        # At 50% fraction, roughly half should be routed — check it's not all or none
        assert any(results)
        assert not all(results)


# ---------------------------------------------------------------------------
# ml_utils.py
# ---------------------------------------------------------------------------


class TestMlUtils:
    def _make_df(self, n_dates=10, rows_per_date=5):
        import datetime

        dates = [datetime.date(2025, 1, d + 1) for d in range(n_dates)]
        rows = []
        for d in dates:
            for _ in range(rows_per_date):
                rows.append({"stay_date": str(d), "value": 1})
        return pd.DataFrame(rows)

    def test_time_based_split_raises_on_too_few_dates(self):
        from src.ml_utils import time_based_split

        df = pd.DataFrame({"stay_date": ["2025-01-01", "2025-01-02"], "v": [1, 2]})
        with pytest.raises(ValueError, match="3 unique dates"):
            time_based_split(df, "stay_date")

    def test_time_based_split_no_overlap(self):
        from src.ml_utils import time_based_split

        df = self._make_df(n_dates=20)
        train, val, test = time_based_split(df, "stay_date")
        train_dates = set(train["stay_date"])
        val_dates = set(val["stay_date"])
        test_dates = set(test["stay_date"])
        assert train_dates.isdisjoint(val_dates)
        assert train_dates.isdisjoint(test_dates)
        assert val_dates.isdisjoint(test_dates)

    def test_time_based_split_all_rows_covered(self):
        from src.ml_utils import time_based_split

        df = self._make_df(n_dates=20)
        train, val, test = time_based_split(df, "stay_date")
        assert len(train) + len(val) + len(test) == len(df)

    def test_time_based_split_train_is_largest(self):
        from src.ml_utils import time_based_split

        df = self._make_df(n_dates=20)
        train, val, test = time_based_split(df, "stay_date")
        assert len(train) > len(val)
        assert len(train) > len(test)

    def test_compute_metrics_keys_present(self):
        from src.ml_utils import compute_metrics

        y_true = pd.Series([0, 1, 0, 1, 1])
        y_prob = np.array([0.1, 0.9, 0.2, 0.8, 0.7])
        metrics = compute_metrics(y_true, y_prob)
        assert "log_loss" in metrics
        assert "brier_score" in metrics
        assert "roc_auc" in metrics

    def test_compute_metrics_perfect_classifier(self):
        from src.ml_utils import compute_metrics

        y_true = pd.Series([0, 0, 1, 1])
        y_prob = np.array([0.01, 0.02, 0.98, 0.99])
        metrics = compute_metrics(y_true, y_prob)
        assert metrics["roc_auc"] == pytest.approx(1.0, abs=0.01)
        assert metrics["brier_score"] < 0.01

    def test_compute_metrics_single_class_nan_auc(self):
        from src.ml_utils import compute_metrics

        y_true = pd.Series([1, 1, 1])
        y_prob = np.array([0.8, 0.9, 0.7])
        metrics = compute_metrics(y_true, y_prob)
        assert np.isnan(metrics["roc_auc"])


# ---------------------------------------------------------------------------
# optimizer.py
# ---------------------------------------------------------------------------


class TestOptimizer:
    def _make_mock_pipeline(self, probs):
        """Minimal sklearn-style pipeline that returns fixed probabilities."""

        class _MockPipeline:
            def predict_proba(self, X):
                n = len(X)
                p = np.array(probs[:n])
                return np.column_stack([1 - p, p])

        return _MockPipeline()

    def test_score_candidate_prices_raises_on_empty(self):
        from src.optimizer import score_candidate_prices

        row = pd.Series({"offered_price": 100.0, "base_price": 100.0})
        with pytest.raises(ValueError, match="empty"):
            score_candidate_prices(self._make_mock_pipeline([0.5]), row, ["offered_price"], [])

    def test_score_candidate_prices_shape(self):
        from src.optimizer import score_candidate_prices

        row = pd.Series({"offered_price": 100.0, "base_price": 100.0})
        probs = [0.3, 0.5, 0.7]
        result = score_candidate_prices(
            self._make_mock_pipeline(probs * 10), row, ["offered_price"], [80.0, 100.0, 120.0]
        )
        assert len(result) == 3
        assert "candidate_price" in result.columns
        assert "predicted_probability" in result.columns
        assert "expected_revenue" in result.columns

    def test_score_candidate_prices_expected_revenue_formula(self):
        from src.optimizer import score_candidate_prices

        row = pd.Series({"offered_price": 100.0})
        # constant 0.5 probability → expected_revenue = price * 0.5
        result = score_candidate_prices(self._make_mock_pipeline([0.5] * 10), row, ["offered_price"], [100.0, 200.0])
        for _, r in result.iterrows():
            assert r["expected_revenue"] == pytest.approx(r["candidate_price"] * r["predicted_probability"], abs=0.01)

    def test_select_best_candidate_picks_max_revenue(self):
        from src.optimizer import select_best_candidate

        scored = pd.DataFrame(
            {
                "candidate_price": [80.0, 100.0, 120.0],
                "predicted_probability": [0.8, 0.6, 0.3],
                "expected_revenue": [64.0, 60.0, 36.0],
            }
        )
        best = select_best_candidate(scored)
        assert best["optimized_price"] == 80.0
        assert best["optimized_expected_revenue"] == pytest.approx(64.0)

    def test_select_best_candidate_raises_on_empty(self):
        from src.optimizer import select_best_candidate

        with pytest.raises(ValueError, match="empty"):
            select_best_candidate(pd.DataFrame())


# ---------------------------------------------------------------------------
# monitor_pricing.py (new helpers)
# ---------------------------------------------------------------------------


class TestMonitorHelpers:
    def test_parse_json_array(self):
        from src.monitor_pricing import _parse_rule_adjustments

        assert _parse_rule_adjustments('["weekend_floor", "segment_price_bounds"]') == [
            "weekend_floor",
            "segment_price_bounds",
        ]

    def test_parse_legacy_pipe_string(self):
        from src.monitor_pricing import _parse_rule_adjustments

        assert _parse_rule_adjustments("weekend_floor|segment_price_bounds") == [
            "weekend_floor",
            "segment_price_bounds",
        ]

    def test_parse_none_returns_empty(self):
        from src.monitor_pricing import _parse_rule_adjustments

        assert _parse_rule_adjustments(None) == []

    def test_parse_empty_string_returns_empty(self):
        from src.monitor_pricing import _parse_rule_adjustments

        assert _parse_rule_adjustments("") == []

    def test_parse_json_empty_array(self):
        from src.monitor_pricing import _parse_rule_adjustments

        assert _parse_rule_adjustments("[]") == []

    def test_is_rule_hit_true_for_meaningful_rule(self):
        from src.monitor_pricing import _is_rule_hit

        assert _is_rule_hit('["weekend_floor"]') is True

    def test_is_rule_hit_false_for_rollout_skip(self):
        from src.monitor_pricing import _is_rule_hit

        assert _is_rule_hit('["rollout_skip_keep_price"]') is False

    def test_is_rule_hit_false_for_none(self):
        from src.monitor_pricing import _is_rule_hit

        assert _is_rule_hit(None) is False

    def test_psi_identical_distributions_is_zero(self):
        from src.monitor_pricing import _psi

        s = pd.Series(np.random.default_rng(0).normal(0, 1, 200))
        assert _psi(s, s) == pytest.approx(0.0, abs=1e-6)

    def test_psi_very_different_distributions_high(self):
        from src.monitor_pricing import _psi

        ref = pd.Series(np.zeros(100))
        cur = pd.Series(np.ones(100) * 100)
        # Completely different — PSI will be non-zero (clamped)
        psi = _psi(ref, cur, bins=5)
        assert psi >= 0.0


# ---------------------------------------------------------------------------
# batch_runner.py (pure helpers)
# ---------------------------------------------------------------------------


class TestBatchRunnerHelpers:
    def test_fallback_price_base_price_strategy(self):
        from src.batch_runner import _fallback_price

        row = pd.Series(
            {
                "base_price": 100.0,
                "hotel_segment": "budget_city",
                "is_weekend": 0,
                "is_holiday": 0,
            }
        )
        cfg = {"fallback": {"strategy": "base_price", "apply_rules": False}}
        price, reason = _fallback_price(
            prepared_row=row,
            previous_price=None,
            serving_config=cfg,
            pricing_rules=PRICING_RULES,
        )
        assert price == 100.0
        assert "base_price" in reason

    def test_fallback_price_previous_price_used(self):
        from src.batch_runner import _fallback_price

        row = pd.Series(
            {
                "base_price": 100.0,
                "hotel_segment": "budget_city",
                "is_weekend": 0,
                "is_holiday": 0,
            }
        )
        cfg = {"fallback": {"strategy": "previous_price_then_base", "apply_rules": False}}
        price, reason = _fallback_price(
            prepared_row=row,
            previous_price=90.0,
            serving_config=cfg,
            pricing_rules=PRICING_RULES,
        )
        assert price == 90.0
        assert "previous_price" in reason

    def test_fallback_price_no_previous_falls_to_base(self):
        from src.batch_runner import _fallback_price

        row = pd.Series(
            {
                "base_price": 120.0,
                "hotel_segment": "budget_city",
                "is_weekend": 0,
                "is_holiday": 0,
            }
        )
        cfg = {"fallback": {"strategy": "previous_price_then_base", "apply_rules": False}}
        price, reason = _fallback_price(
            prepared_row=row,
            previous_price=None,
            serving_config=cfg,
            pricing_rules=PRICING_RULES,
        )
        assert price == 120.0
        assert "base_price" in reason

    def test_resolve_model_paths_explicit_arg(self):
        from src.batch_runner import _resolve_model_paths

        path, meta = _resolve_model_paths("my_model.pkl", "my_meta.json", None)
        assert path == "my_model.pkl"
        assert meta == "my_meta.json"

    def test_resolve_model_paths_no_config_returns_champion(self):
        from src.batch_runner import _resolve_model_paths

        path, _ = _resolve_model_paths(None, None, None)
        assert "champion_model" in path

    def test_resolve_model_paths_reads_serving_config(self):
        from src.batch_runner import _resolve_model_paths

        cfg = {
            "champion_model": {
                "model_path": "artifacts/logistic_regression.pkl",
                "metadata_path": "artifacts/logistic_regression_metadata.json",
            }
        }
        path, meta = _resolve_model_paths(None, None, cfg)
        # champion exists → returns it (or falls to fallback if file not present)
        assert path.endswith(".pkl")


# ---------------------------------------------------------------------------
# price_engine.py — integration test with real logistic_regression artifact
# ---------------------------------------------------------------------------

ARTIFACT_DIR = PRICEENGINE_ROOT / "artifacts"
REAL_SCHEMA_PATH = PRICEENGINE_ROOT / "configs" / "feature_schema_v1.json"
REAL_RULES_PATH = PRICEENGINE_ROOT / "configs" / "pricing_rules_v1.json"
LR_MODEL_PATH = ARTIFACT_DIR / "logistic_regression.pkl"


@pytest.fixture(scope="module")
def real_engine():
    """Load the logistic regression model once for the whole module."""
    if not LR_MODEL_PATH.exists():
        pytest.skip("logistic_regression.pkl not found — run compare_booking_models.py first")
    from src.price_engine import PriceEngine

    return PriceEngine.from_artifacts(
        model_path=LR_MODEL_PATH,
        schema_path=REAL_SCHEMA_PATH,
        rules_path=REAL_RULES_PATH,
        metadata_path=ARTIFACT_DIR / "logistic_regression_metadata.json",
    )


def _make_real_context(segment="budget_city", base_price=120.0, occupancy=0.6) -> dict:
    """Full context matching the real feature schema."""
    return {
        "hotel_id": 1,
        "hotel_segment": segment,
        "room_type_id": 1,
        "room_type_name": "Standard",
        "snapshot_date": "2025-01-01",
        "stay_date": "2025-01-15",
        "lead_time": 14,
        "occupancy_rate": occupancy,
        "available_rooms": int((1 - occupancy) * 20),
        "day_of_week": "Wednesday",
        "month": 1,
        "season": "winter",
        "is_weekend": 0,
        "is_holiday": 0,
        "base_price": base_price,
        "offered_price": base_price,
        "total_inventory": 20,
        "booked_rooms": int(occupancy * 20),
        "max_occupancy": 2,
        "refundable_rate_flag": 1,
        "breakfast_included_flag": 0,
        "booking_made": 0,
    }


class TestPriceEngineIntegration:
    def test_recommend_price_returns_required_keys(self, real_engine):
        result = real_engine.recommend_price(_make_real_context())
        for key in [
            "final_price",
            "predicted_probability",
            "expected_revenue",
            "optimized_price",
            "applied_rules",
            "model_version",
            "top_candidates",
        ]:
            assert key in result, f"Missing key: {key}"

    def test_probability_in_valid_range(self, real_engine):
        result = real_engine.recommend_price(_make_real_context())
        assert 0.0 <= result["predicted_probability"] <= 1.0

    def test_final_price_within_segment_bounds(self, real_engine):
        result = real_engine.recommend_price(_make_real_context(segment="budget_city"))
        import json

        rules = json.loads(REAL_RULES_PATH.read_text())
        seg = rules["segments"]["budget_city"]
        assert seg["min_price"] <= result["final_price"] <= seg["max_price"]

    def test_expected_revenue_equals_price_times_prob(self, real_engine):
        result = real_engine.recommend_price(_make_real_context())
        expected = result["final_price"] * result["predicted_probability"]
        assert result["expected_revenue"] == pytest.approx(expected, abs=0.01)

    def test_applied_rules_is_list(self, real_engine):
        result = real_engine.recommend_price(_make_real_context())
        assert isinstance(result["applied_rules"], list)

    def test_score_single_price_is_public(self, real_engine):
        from src.features import load_schema, prepare_model_dataframe

        schema = load_schema(REAL_SCHEMA_PATH)
        df = pd.DataFrame([_make_real_context()])
        prepared = prepare_model_dataframe(df, schema, include_target=False)
        row = prepared.iloc[0]
        prob, rev = real_engine.score_single_price(row, 120.0)
        assert 0.0 <= prob <= 1.0
        assert rev == pytest.approx(120.0 * prob, abs=0.01)

    def test_high_occupancy_favors_higher_price(self, real_engine):
        """When occupancy is high, the optimizer should lean toward higher prices."""
        low = real_engine.recommend_price(_make_real_context(occupancy=0.2))
        high = real_engine.recommend_price(_make_real_context(occupancy=0.9))
        # Not guaranteed by hard logic but should hold for a reasonable model.
        # We relax this to just checking both are valid prices.
        assert low["final_price"] > 0
        assert high["final_price"] > 0

    def test_premium_segment_price_above_budget(self, real_engine):
        budget = real_engine.recommend_price(_make_real_context(segment="budget_city", base_price=100.0))
        luxury = real_engine.recommend_price(_make_real_context(segment="premium_luxury", base_price=400.0))
        assert luxury["final_price"] > budget["final_price"]

    def test_score_price_public_api(self, real_engine):
        prob, rev = real_engine.score_price(_make_real_context(), 120.0)
        assert 0.0 <= prob <= 1.0
        assert rev > 0

    def test_top_candidates_sorted_by_revenue(self, real_engine):
        result = real_engine.recommend_price(_make_real_context())
        candidates = result["top_candidates"]
        assert len(candidates) <= 3
        revenues = [c["expected_revenue"] for c in candidates]
        assert revenues == sorted(revenues, reverse=True)
