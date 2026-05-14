import random
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

SEED = 42


def set_random_seed(seed: int = SEED) -> None:
    """Set seeds for reproducible synthetic data."""
    random.seed(seed)
    np.random.seed(seed)


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def month_to_season(month: int) -> str:
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "autumn"


def nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> date:
    """Return nth weekday of a month. weekday: Monday=0 ... Sunday=6."""
    d = date(year, month, 1)
    while d.weekday() != weekday:
        d += timedelta(days=1)
    d += timedelta(weeks=n - 1)
    return d


def last_weekday_of_month(year: int, month: int, weekday: int) -> date:
    d = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year, 12, 31)
    while d.weekday() != weekday:
        d -= timedelta(days=1)
    return d


def build_us_holidays(years: set[int]) -> set[date]:
    """Simple US holiday calendar used for demand and pricing effects."""
    holidays: set[date] = set()
    for year in years:
        fixed = {
            date(year, 1, 1),  # New Year's Day
            date(year, 7, 4),  # Independence Day
            date(year, 11, 11),  # Veterans Day
            date(year, 12, 25),  # Christmas Day
        }
        variable = {
            nth_weekday_of_month(year, 1, 0, 3),  # MLK Day
            nth_weekday_of_month(year, 2, 0, 3),  # Presidents' Day
            last_weekday_of_month(year, 5, 0),  # Memorial Day
            nth_weekday_of_month(year, 9, 0, 1),  # Labor Day
            nth_weekday_of_month(year, 11, 3, 4),  # Thanksgiving
        }
        holidays.update(fixed)
        holidays.update(variable)
    return holidays


def get_hotel_profiles() -> list[dict]:
    return [
        {
            "hotel_id": 1,
            "hotel_segment": "budget_city",
            "base_price": 82.0,
            "total_rooms": 170,
            "segment_demand": 0.95,
            "price_premium": -0.08,
            "refundable_prob": 0.35,
            "breakfast_prob": 0.28,
            "cancel_tendency": 0.03,
            "high_season_months": {5, 6, 7, 8, 12},
            "location_index_mean": 96.0,
            "search_base": 55.0,
            "optional_features": {
                "competitor_price": True,
                "event_score": True,
                "search_volume": True,
                "sea_view_flag": False,
                "balcony_flag": False,
                "amenity_score": False,
                "location_demand_index": True,
            },
        },
        {
            "hotel_id": 2,
            "hotel_segment": "business",
            "base_price": 145.0,
            "total_rooms": 190,
            "segment_demand": 1.03,
            "price_premium": 0.03,
            "refundable_prob": 0.56,
            "breakfast_prob": 0.62,
            "cancel_tendency": 0.04,
            "high_season_months": {3, 4, 5, 9, 10, 11},
            "location_index_mean": 104.0,
            "search_base": 68.0,
            "optional_features": {
                "competitor_price": True,
                "event_score": True,
                "search_volume": True,
                "sea_view_flag": False,
                "balcony_flag": False,
                "amenity_score": True,
                "location_demand_index": True,
            },
        },
        {
            "hotel_id": 3,
            "hotel_segment": "beach_resort",
            "base_price": 178.0,
            "total_rooms": 160,
            "segment_demand": 1.12,
            "price_premium": 0.10,
            "refundable_prob": 0.64,
            "breakfast_prob": 0.74,
            "cancel_tendency": 0.05,
            "high_season_months": {1, 6, 7, 8, 12},
            "location_index_mean": 112.0,
            "search_base": 72.0,
            "optional_features": {
                "competitor_price": False,
                "event_score": True,
                "search_volume": True,
                "sea_view_flag": True,
                "balcony_flag": True,
                "amenity_score": True,
                "location_demand_index": True,
            },
        },
        {
            "hotel_id": 4,
            "hotel_segment": "premium_luxury",
            "base_price": 292.0,
            "total_rooms": 130,
            "segment_demand": 0.90,
            "price_premium": 0.24,
            "refundable_prob": 0.76,
            "breakfast_prob": 0.90,
            "cancel_tendency": 0.02,
            "high_season_months": {6, 7, 8, 12},
            "location_index_mean": 118.0,
            "search_base": 60.0,
            "optional_features": {
                "competitor_price": False,
                "event_score": True,
                "search_volume": False,
                "sea_view_flag": True,
                "balcony_flag": True,
                "amenity_score": True,
                "location_demand_index": True,
            },
        },
    ]


def get_room_types() -> list[dict]:
    return [
        {
            "room_type_id": 1,
            "room_type_name": "Standard",
            "price_multiplier": 1.00,
            "inventory_share": 0.56,
            "max_occupancy": 2,
            "premium_uplift": 0.00,
            "refund_bonus": -0.02,
            "breakfast_bonus": -0.06,
            "multi_book_prob": 0.02,
            "sea_view_prob": 0.08,
            "balcony_prob": 0.12,
            "amenity_bonus": 0.0,
        },
        {
            "room_type_id": 2,
            "room_type_name": "Deluxe",
            "price_multiplier": 1.35,
            "inventory_share": 0.30,
            "max_occupancy": 3,
            "premium_uplift": 0.08,
            "refund_bonus": 0.03,
            "breakfast_bonus": 0.07,
            "multi_book_prob": 0.05,
            "sea_view_prob": 0.45,
            "balcony_prob": 0.55,
            "amenity_bonus": 0.7,
        },
        {
            "room_type_id": 3,
            "room_type_name": "Suite",
            "price_multiplier": 1.95,
            "inventory_share": 0.14,
            "max_occupancy": 4,
            "premium_uplift": 0.18,
            "refund_bonus": 0.08,
            "breakfast_bonus": 0.12,
            "multi_book_prob": 0.09,
            "sea_view_prob": 0.75,
            "balcony_prob": 0.80,
            "amenity_bonus": 1.4,
        },
    ]


def generate_stay_dates(start_date: date, num_days: int) -> list[date]:
    return [start_date + timedelta(days=i) for i in range(num_days)]


def draw_event_score(hotel: dict, is_high_season: int, is_holiday: int, is_weekend: int) -> float:
    """Create event intensity for hotels that track event-driven demand."""
    base = 2.0 + 2.2 * is_high_season + 1.4 * is_holiday
    if hotel["hotel_segment"] == "business":
        base += 1.6 * (1 - is_weekend)
    if hotel["hotel_segment"] == "beach_resort":
        base += 1.0 * is_weekend
    score = np.random.normal(base, 1.8)
    return round(clamp(score, 0.0, 10.0), 2)


def compute_base_price(
    hotel: dict,
    room: dict,
    is_weekend: int,
    is_high_season: int,
    is_holiday: int,
) -> float:
    """Baseline rate before occupancy and offer strategy effects."""
    base = hotel["base_price"] * room["price_multiplier"]
    base *= 1.0 + 0.06 * is_weekend + 0.10 * is_high_season + 0.12 * is_holiday
    base *= 1.0 + np.random.normal(0.0, 0.03)
    return round(max(35.0, base), 2)


def compute_offered_price(
    base_price: float,
    hotel: dict,
    room: dict,
    occupancy_rate: float,
    is_weekend: int,
    is_high_season: int,
    is_holiday: int,
    event_score: float | None,
    competitor_price: float | None,
) -> float:
    """Dynamic offered price with occupancy, segment, room and calendar effects."""
    event_boost = 0.0 if event_score is None else 0.014 * event_score
    uplift = (
        hotel["price_premium"]
        + room["premium_uplift"]
        + 0.34 * occupancy_rate
        + 0.06 * is_weekend
        + 0.09 * is_high_season
        + 0.08 * is_holiday
        + event_boost
        + np.random.normal(0.0, 0.03)
    )
    offered = base_price * (1.0 + uplift)

    # Hotels with competitor tracking stay somewhat anchored to market rates.
    if competitor_price is not None:
        offered = 0.75 * offered + 0.25 * competitor_price * (1.0 + np.random.normal(0.0, 0.02))

    offered = max(base_price * 0.65, offered)
    return round(offered, 2)


def compute_booking_probability(
    demand_signal: float,
    offered_price: float,
    base_price: float,
    available_rooms: int,
    event_score: float | None,
) -> float:
    """Turn demand and price context into probability of conversion."""
    if available_rooms <= 0:
        return 0.0

    relative_price = offered_price / max(base_price, 1.0)
    price_penalty = 2.3 * (relative_price - 1.0)
    event_bonus = 0.0 if event_score is None else 0.04 * event_score
    logit = demand_signal + event_bonus - price_penalty
    prob = sigmoid(logit)
    return float(clamp(prob, 0.0, 0.95))


def sample_rooms_booked(booking_made: int, available_rooms: int, room: dict) -> int:
    if booking_made == 0 or available_rooms <= 0:
        return 0
    if available_rooms >= 2 and random.random() < room["multi_book_prob"]:
        return 2
    return 1


def sample_cancellation(booking_made: int, refundable_rate_flag: int, lead_time: int, hotel: dict) -> int:
    if booking_made == 0:
        return 0
    cancel_prob = (
        0.015
        + hotel["cancel_tendency"]
        + 0.13 * refundable_rate_flag
        + 0.0016 * lead_time
        + np.random.normal(0.0, 0.01)
    )
    cancel_prob = clamp(cancel_prob, 0.01, 0.55)
    return int(random.random() < cancel_prob)


def update_booked_state(
    current_booked: int,
    total_inventory: int,
    demand_signal: float,
    lead_time: int,
    row_effective_bookings: int,
) -> int:
    """
    Update inventory state for next snapshot.
    We add market-level new bookings and subtract market-level cancellations
    so occupancy tends to rise toward check-in but can still move down at times.
    """
    if total_inventory <= 0:
        return 0

    occupancy_rate = current_booked / total_inventory
    closeness = 1.0 - (lead_time / 60.0)

    market_lambda = (0.15 + 1.1 * sigmoid(demand_signal) + 0.8 * closeness) * (1.0 - occupancy_rate)
    market_lambda = max(0.0, market_lambda)
    market_new_bookings = np.random.poisson(market_lambda)
    market_new_bookings = min(market_new_bookings, max(0, total_inventory - current_booked))

    market_cancel_prob = clamp(0.002 + 0.0009 * lead_time, 0.0, 0.08)
    market_cancellations = np.random.binomial(current_booked, market_cancel_prob) if current_booked > 0 else 0

    next_booked = current_booked - market_cancellations + market_new_bookings + row_effective_bookings
    return int(clamp(next_booked, 0, total_inventory))


def simulate_snapshots_for_stay(
    hotel: dict,
    room: dict,
    stay_date: date,
    holidays: set[date],
) -> list[dict]:
    rows: list[dict] = []

    day_of_week = stay_date.strftime("%A")
    month = stay_date.month
    season = month_to_season(month)
    is_weekend = int(stay_date.weekday() >= 5)
    is_holiday = int(stay_date in holidays)
    is_high_season = int(month in hotel["high_season_months"])

    # Optional hotel features are populated only where available; otherwise NaN.
    features = hotel["optional_features"]
    event_anchor = (
        draw_event_score(hotel, is_high_season, is_holiday, is_weekend) if features["event_score"] else np.nan
    )
    sea_view_flag = int(random.random() < room["sea_view_prob"]) if features["sea_view_flag"] else np.nan
    balcony_flag = int(random.random() < room["balcony_prob"]) if features["balcony_flag"] else np.nan
    amenity_score = (
        round(clamp(np.random.normal(6.0 + room["amenity_bonus"], 0.7), 1.0, 10.0), 2)
        if features["amenity_score"]
        else np.nan
    )
    location_index_anchor = (
        hotel["location_index_mean"] + 8.0 * is_high_season + 4.0 * is_weekend + np.random.normal(0.0, 4.0)
        if features["location_demand_index"]
        else np.nan
    )

    # Keep inventory mostly stable for this stay date, with tiny maintenance noise.
    maintenance_rooms = np.random.binomial(3, 0.12)
    total_inventory = int(round(hotel["total_rooms"] * room["inventory_share"])) - maintenance_rooms
    total_inventory = max(4, total_inventory)

    # Start with low-to-mid occupancy at 60-day lead.
    initial_occ_ratio = (
        0.07 + 0.10 * is_high_season + 0.05 * is_weekend + 0.05 * hotel["segment_demand"] + np.random.normal(0.0, 0.03)
    )
    initial_occ_ratio = clamp(initial_occ_ratio, 0.03, 0.55)
    current_booked = int(round(total_inventory * initial_occ_ratio))

    for lead_time in range(60, -1, -1):
        snapshot_date = stay_date - timedelta(days=lead_time)
        booked_rooms = int(clamp(current_booked, 0, total_inventory))
        available_rooms = total_inventory - booked_rooms
        occupancy_rate = booked_rooms / total_inventory

        base_price = compute_base_price(hotel, room, is_weekend, is_high_season, is_holiday)

        event_score = (
            round(clamp(event_anchor + np.random.normal(0.0, 0.7), 0.0, 10.0), 2) if features["event_score"] else np.nan
        )
        event_score_value = None if pd.isna(event_score) else float(event_score)

        competitor_price = None
        if features["competitor_price"]:
            competitor_raw = np.random.normal(base_price * (0.98 + 0.05 * is_high_season), base_price * 0.08)
            competitor_price = round(max(30.0, competitor_raw), 2)

        if features["search_volume"]:
            # Search demand tends to peak in mid-lead windows and around high-demand dates.
            lead_peak = np.exp(-((lead_time - 22) ** 2) / (2 * 15**2))
            search_volume = (
                hotel["search_base"]
                + 48.0 * lead_peak
                + 12.0 * is_high_season
                + 7.0 * is_weekend
                + (0.0 if event_score_value is None else 3.5 * event_score_value)
                + np.random.normal(0.0, 8.0)
            )
            search_volume = int(clamp(round(search_volume), 5, 260))
        else:
            search_volume = np.nan

        if features["location_demand_index"]:
            location_demand_index = location_index_anchor + np.random.normal(0.0, 3.0) + 4.0 * (1.0 - lead_time / 60.0)
            location_demand_index = round(clamp(location_demand_index, 55.0, 170.0), 2)
        else:
            location_demand_index = np.nan

        refundable_prob = clamp(hotel["refundable_prob"] + room["refund_bonus"], 0.05, 0.95)
        refundable_rate_flag = int(random.random() < refundable_prob)

        breakfast_prob = clamp(hotel["breakfast_prob"] + room["breakfast_bonus"], 0.05, 0.98)
        breakfast_included_flag = int(random.random() < breakfast_prob)

        lead_closeness = 1.0 - (lead_time / 60.0)
        demand_signal = (
            -1.55
            + hotel["segment_demand"]
            + 0.30 * is_weekend
            + 0.38 * is_high_season
            + 0.50 * lead_closeness
            + (0.0 if event_score_value is None else 0.06 * event_score_value)
            + (0.0 if pd.isna(search_volume) else 0.0022 * (search_volume - hotel["search_base"]))
            + (0.0 if pd.isna(location_demand_index) else 0.003 * (location_demand_index - 100.0))
            + np.random.normal(0.0, 0.22)
        )

        offered_price = compute_offered_price(
            base_price=base_price,
            hotel=hotel,
            room=room,
            occupancy_rate=occupancy_rate,
            is_weekend=is_weekend,
            is_high_season=is_high_season,
            is_holiday=is_holiday,
            event_score=event_score_value,
            competitor_price=competitor_price,
        )

        booking_probability = compute_booking_probability(
            demand_signal=demand_signal,
            offered_price=offered_price,
            base_price=base_price,
            available_rooms=available_rooms,
            event_score=event_score_value,
        )
        booking_made = int(random.random() < booking_probability)
        rooms_booked = sample_rooms_booked(booking_made, available_rooms, room)
        cancellation = sample_cancellation(booking_made, refundable_rate_flag, lead_time, hotel)
        final_price = offered_price if booking_made == 1 else np.nan

        row = {
            "hotel_id": hotel["hotel_id"],
            "hotel_segment": hotel["hotel_segment"],
            "room_type_id": room["room_type_id"],
            "room_type_name": room["room_type_name"],
            "snapshot_date": snapshot_date.isoformat(),
            "stay_date": stay_date.isoformat(),
            "lead_time": lead_time,
            "day_of_week": day_of_week,
            "month": month,
            "season": season,
            "is_weekend": is_weekend,
            "is_holiday": is_holiday,
            "total_inventory": total_inventory,
            "booked_rooms": booked_rooms,
            "available_rooms": available_rooms,
            "occupancy_rate": round(occupancy_rate, 4),
            "base_price": base_price,
            "offered_price": offered_price,
            "final_price": final_price,
            "booking_made": booking_made,
            "rooms_booked": rooms_booked,
            "cancellation": cancellation,
            "max_occupancy": room["max_occupancy"],
            "refundable_rate_flag": refundable_rate_flag,
            "breakfast_included_flag": breakfast_included_flag,
            "competitor_price": competitor_price if competitor_price is not None else np.nan,
            "event_score": event_score if not pd.isna(event_score) else np.nan,
            "search_volume": search_volume,
            "sea_view_flag": sea_view_flag,
            "balcony_flag": balcony_flag,
            "amenity_score": amenity_score,
            "location_demand_index": location_demand_index,
        }
        rows.append(row)

        row_effective_bookings = rooms_booked if (booking_made == 1 and cancellation == 0) else 0
        current_booked = update_booked_state(
            current_booked=current_booked,
            total_inventory=total_inventory,
            demand_signal=demand_signal,
            lead_time=lead_time,
            row_effective_bookings=row_effective_bookings,
        )

    return rows


def generate_dataset(
    start_date: date,
    num_stay_dates: int = 180,
) -> pd.DataFrame:
    hotels = get_hotel_profiles()
    room_types = get_room_types()
    stay_dates = generate_stay_dates(start_date, num_stay_dates)

    years_needed = {start_date.year, (start_date + timedelta(days=num_stay_dates + 60)).year}
    holidays = build_us_holidays(years_needed)

    all_rows: list[dict] = []
    for hotel in hotels:
        for room in room_types:
            for stay_date in stay_dates:
                all_rows.extend(simulate_snapshots_for_stay(hotel, room, stay_date, holidays))

    df = pd.DataFrame(all_rows)

    # Enforce required relationships after generation.
    df["available_rooms"] = df["total_inventory"] - df["booked_rooms"]
    df["occupancy_rate"] = (df["booked_rooms"] / df["total_inventory"]).round(4)
    df.loc[df["booking_made"] == 0, "final_price"] = np.nan
    df.loc[df["booking_made"] == 0, "cancellation"] = 0
    df.loc[df["booking_made"] == 0, "rooms_booked"] = 0

    return df


def main() -> None:
    set_random_seed(SEED)

    # 180 stay dates per hotel, snapshots from 60 days before check-in to check-in.
    # 4 hotels * 3 room types * 180 stay dates * 61 snapshots = 131,760 rows.
    start_date = datetime(2026, 1, 1).date()
    df = generate_dataset(start_date=start_date, num_stay_dates=180)

    output_file = "synthetic_hotel_pricing.csv"
    df.to_csv(output_file, index=False)

    print(f"Saved dataset to: {output_file}")
    print(f"Dataset shape: {df.shape}")
    print(df.head(10).to_string(index=False))


if __name__ == "__main__":
    main()
