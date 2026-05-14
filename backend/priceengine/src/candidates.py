from typing import Any


def round_price(value: float, decimals: int = 2) -> float:
    return round(float(value), decimals)


def _get_segment_rules(pricing_rules: dict[str, Any], hotel_segment: str) -> dict[str, Any]:
    segments = pricing_rules.get("segments", {})
    if hotel_segment not in segments:
        raise ValueError(f"Missing pricing rules for hotel_segment='{hotel_segment}'")
    return segments[hotel_segment]


def _apply_segment_bounds(price: float, segment_rules: dict[str, Any]) -> float:
    return max(segment_rules["min_price"], min(price, segment_rules["max_price"]))


def generate_candidate_prices(
    base_price: float,
    hotel_segment: str,
    pricing_rules: dict[str, Any],
    current_price: float | None = None,
) -> list[float]:
    """
    Generate candidate prices around base price using percentage steps.
    Segment min/max bounds are applied to avoid invalid candidates.
    """
    segment_rules = _get_segment_rules(pricing_rules, hotel_segment)
    global_rules = pricing_rules.get("global", {})
    decimals = int(global_rules.get("price_rounding_decimals", 2))
    steps = global_rules.get(
        "candidate_price_steps_pct",
        [-0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2],
    )

    candidate_values: list[float] = []
    for step in steps:
        candidate = base_price * (1.0 + float(step))
        candidate = _apply_segment_bounds(candidate, segment_rules)
        candidate_values.append(round_price(candidate, decimals))

    # Keep current displayed price in candidate set when available.
    if current_price is not None:
        bounded_current = _apply_segment_bounds(float(current_price), segment_rules)
        candidate_values.append(round_price(bounded_current, decimals))

    # De-duplicate while preserving sorted order.
    unique_sorted = sorted(set(candidate_values))
    return unique_sorted
