from typing import Any


def _get_segment_rules(pricing_rules: dict[str, Any], hotel_segment: str) -> dict[str, Any]:
    segments = pricing_rules.get("segments", {})
    if hotel_segment not in segments:
        raise ValueError(f"Missing pricing rules for hotel_segment='{hotel_segment}'")
    return segments[hotel_segment]


def apply_business_rules(
    candidate_price: float,
    hotel_segment: str,
    base_price: float,
    is_weekend: int,
    is_holiday: int,
    pricing_rules: dict[str, Any],
    previous_price: float | None = None,
    manual_override_price: float | None = None,
) -> tuple[float, list[str]]:
    """
    Apply post-optimization business constraints.
    Returns adjusted final price and list of applied rule labels.
    """
    segment_rules = _get_segment_rules(pricing_rules, hotel_segment)
    decimals = int(pricing_rules.get("global", {}).get("price_rounding_decimals", 2))

    applied_rules: list[str] = []
    final_price = float(candidate_price)

    if manual_override_price is not None:
        final_price = float(manual_override_price)
        applied_rules.append("manual_override")

    # Hard bounds.
    min_price = float(segment_rules["min_price"])
    max_price = float(segment_rules["max_price"])
    bounded_price = max(min_price, min(final_price, max_price))
    if bounded_price != final_price:
        applied_rules.append("segment_price_bounds")
        final_price = bounded_price

    # Avoid abrupt changes relative to current/published price.
    if previous_price is not None:
        max_daily_change_pct = float(segment_rules["max_daily_change_pct"])
        low = float(previous_price) * (1.0 - max_daily_change_pct)
        high = float(previous_price) * (1.0 + max_daily_change_pct)
        shock_limited = max(low, min(final_price, high))
        if shock_limited != final_price:
            applied_rules.append("max_daily_change")
            final_price = shock_limited

    # Weekend / holiday floor protections.
    if int(is_weekend) == 1:
        weekend_floor = float(base_price) * float(segment_rules.get("weekend_min_multiplier", 1.0))
        if final_price < weekend_floor:
            final_price = weekend_floor
            applied_rules.append("weekend_floor")

    if int(is_holiday) == 1:
        holiday_floor = float(base_price) * float(segment_rules.get("holiday_min_multiplier", 1.0))
        if final_price < holiday_floor:
            final_price = holiday_floor
            applied_rules.append("holiday_floor")

    return round(final_price, decimals), applied_rules
