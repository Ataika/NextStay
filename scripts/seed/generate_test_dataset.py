"""
Generate synthetic hotel pricing datasets for testing the pricing engine.
Produces one CSV per hotel, ready to upload via the Model Training page.

Output:
    scripts/seed/data/hotel_1_budget_city.csv   (~1500 rows)
    scripts/seed/data/hotel_2_business.csv      (~1500 rows)
"""

import math
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 42
random.seed(SEED)

OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HOLIDAYS = {
    date(2024, 1, 1),
    date(2024, 4, 21),
    date(2024, 5, 1),
    date(2024, 6, 2),
    date(2024, 8, 15),
    date(2024, 11, 1),
    date(2024, 12, 8),
    date(2024, 12, 25),
    date(2024, 12, 26),
    date(2025, 1, 1),
    date(2025, 4, 20),
    date(2025, 5, 1),
    date(2025, 6, 2),
    date(2025, 8, 15),
    date(2025, 11, 1),
    date(2025, 12, 8),
    date(2025, 12, 25),
    date(2025, 12, 26),
}

SEASONS = {
    1: "winter",
    2: "winter",
    3: "spring",
    4: "spring",
    5: "spring",
    6: "summer",
    7: "summer",
    8: "summer",
    9: "autumn",
    10: "autumn",
    11: "autumn",
    12: "winter",
}

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def season_demand(month: int) -> float:
    return {
        1: 0.55,
        2: 0.58,
        3: 0.65,
        4: 0.72,
        5: 0.78,
        6: 0.90,
        7: 1.00,
        8: 0.97,
        9: 0.80,
        10: 0.70,
        11: 0.58,
        12: 0.75,
    }[month]


def booking_probability(
    offered_price: float,
    base_price: float,
    occupancy: float,
    lead_time: int,
    is_weekend: int,
    is_holiday: int,
    season_factor: float,
    refundable: int,
) -> float:
    price_ratio = offered_price / base_price
    elasticity = -2.0 if refundable else -1.6
    price_effect = math.exp(elasticity * (price_ratio - 1.0))

    occ_effect = 0.5 + 0.6 * occupancy
    lead_effect = math.exp(-0.015 * max(lead_time - 7, 0))
    weekend_boost = 1.10 if is_weekend else 1.0
    holiday_boost = 1.15 if is_holiday else 1.0
    season_boost = 0.7 + 0.6 * season_factor

    raw = 0.38 * price_effect * occ_effect * lead_effect * weekend_boost * holiday_boost * season_boost
    return min(max(raw + random.gauss(0, 0.04), 0.01), 0.97)


def generate_rows(
    hotel_id: int, hotel_segment: str, room_types: list[dict], base_prices: list[float], n_rows: int
) -> list[dict]:
    rows = []
    start_snap = date(2024, 1, 1)
    end_snap = date(2025, 6, 30)
    delta_days = (end_snap - start_snap).days

    while len(rows) < n_rows:
        snap_offset = random.randint(0, delta_days)
        snapshot_date = start_snap + timedelta(days=snap_offset)
        lead_time = random.choice([1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90])
        stay_date = snapshot_date + timedelta(days=lead_time)

        rt = random.choice(room_types)
        base_price = base_prices[room_types.index(rt)]

        dow = stay_date.weekday()
        is_weekend = int(dow >= 5)
        is_holiday = int(stay_date in HOLIDAYS)
        month = stay_date.month
        sfactor = season_demand(month)

        total_inv = rt["inventory"]
        max_occ_rate = min(0.95, sfactor * (1.05 if is_holiday else 1.0))
        booked = int(round(total_inv * random.uniform(max_occ_rate * 0.4, max_occ_rate)))
        booked = max(0, min(booked, total_inv))
        available = total_inv - booked
        occ_rate = round(booked / total_inv, 4)

        price_noise = random.uniform(-0.08, 0.12)
        weekend_adj = 0.07 if is_weekend else 0.0
        holiday_adj = 0.10 if is_holiday else 0.0
        season_adj = (sfactor - 0.7) * 0.3
        offered_price = round(base_price * (1 + price_noise + weekend_adj + holiday_adj + season_adj), 2)

        refundable = random.choices([0, 1], weights=[0.4, 0.6])[0]
        breakfast = random.choices([0, 1], weights=[0.55, 0.45])[0]

        prob = booking_probability(
            offered_price, base_price, occ_rate, lead_time, is_weekend, is_holiday, sfactor, refundable
        )
        booking_made = int(random.random() < prob)

        competitor_price = round(offered_price * random.uniform(0.88, 1.14), 2)
        event_score = round(random.uniform(0.0, 1.0) if random.random() < 0.3 else 0.0, 3)
        search_volume = round(random.uniform(200, 2000) * sfactor, 1)

        rows.append(
            {
                "hotel_id": hotel_id,
                "hotel_segment": hotel_segment,
                "room_type_id": rt["id"],
                "room_type_name": rt["name"],
                "snapshot_date": snapshot_date.isoformat(),
                "stay_date": stay_date.isoformat(),
                "lead_time": lead_time,
                "day_of_week": DAYS[dow],
                "week_of_year": stay_date.isocalendar()[1],
                "month": month,
                "year": stay_date.year,
                "season": SEASONS[month],
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "total_inventory": total_inv,
                "booked_rooms": booked,
                "available_rooms": available,
                "occupancy_rate": occ_rate,
                "base_price": base_price,
                "offered_price": offered_price,
                "final_price": offered_price,
                "booking_made": booking_made,
                "rooms_booked": booking_made,
                "cancellation": int(booking_made and random.random() < 0.12),
                "max_occupancy": rt["max_occ"],
                "refundable_rate_flag": refundable,
                "breakfast_included_flag": breakfast,
                "competitor_price": competitor_price,
                "event_score": event_score if event_score > 0 else "",
                "search_volume": search_volume,
                "sea_view_flag": rt.get("sea_view", 0),
                "balcony_flag": rt.get("balcony", 0),
                "amenity_score": rt.get("amenity_score", ""),
                "location_demand_index": round(random.uniform(0.5, 1.5) * sfactor, 4),
                "feature_schema_version": "feature_schema_v1",
                "source_batch_id": f"synthetic_{hotel_id}_v1",
            }
        )

    rows.sort(key=lambda r: (r["stay_date"], r["snapshot_date"]))
    return rows


def write_csv(rows: list[dict], path: Path) -> None:
    if not rows:
        return
    headers = list(rows[0].keys())
    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(str(row[h]) for h in headers))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Written {len(rows)} rows → {path}")


def main() -> None:
    # Hotel 1 — Budget City (Rome)
    budget_rooms = [
        {
            "id": 1,
            "name": "Standard Single",
            "inventory": 15,
            "max_occ": 1,
            "sea_view": 0,
            "balcony": 0,
            "amenity_score": 2.5,
        },
        {
            "id": 2,
            "name": "Standard Double",
            "inventory": 20,
            "max_occ": 2,
            "sea_view": 0,
            "balcony": 0,
            "amenity_score": 3.0,
        },
    ]
    budget_base_prices = [65.0, 85.0]
    budget_rows = generate_rows(1, "budget_city", budget_rooms, budget_base_prices, 1500)
    write_csv(budget_rows, OUTPUT_DIR / "hotel_1_budget_city.csv")

    # Hotel 2 — Business (Milan)
    business_rooms = [
        {
            "id": 1,
            "name": "Business Standard",
            "inventory": 25,
            "max_occ": 2,
            "sea_view": 0,
            "balcony": 0,
            "amenity_score": 4.0,
        },
        {
            "id": 2,
            "name": "Business Suite",
            "inventory": 10,
            "max_occ": 2,
            "sea_view": 0,
            "balcony": 1,
            "amenity_score": 4.8,
        },
    ]
    business_base_prices = [110.0, 195.0]
    business_rows = generate_rows(2, "business", business_rooms, business_base_prices, 1500)
    write_csv(business_rows, OUTPUT_DIR / "hotel_2_business.csv")

    print("\nDatasets ready. Upload via Model Training page:")
    print(f"  {OUTPUT_DIR / 'hotel_1_budget_city.csv'}")
    print(f"  {OUTPUT_DIR / 'hotel_2_business.csv'}")


if __name__ == "__main__":
    main()
