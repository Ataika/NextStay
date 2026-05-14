import argparse
import json
import sys
from pathlib import Path

import pandas as pd

# Allow running this file as a script from project root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.price_engine import PriceEngine  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Recommend one final price for a single context row.")
    parser.add_argument("--input-csv", default="synthetic_hotel_pricing.csv", help="Context table path.")
    parser.add_argument("--row-index", type=int, default=0, help="Row index to evaluate.")
    parser.add_argument(
        "--model-path",
        default="artifacts/global_booking_model_v1.pkl",
        help="Trained sklearn pipeline artifact.",
    )
    parser.add_argument(
        "--metadata-path",
        default="artifacts/global_booking_model_v1_metadata.json",
        help="Model metadata JSON for version labels.",
    )
    parser.add_argument(
        "--schema-path",
        default="configs/feature_schema_v1.json",
        help="Feature schema contract path.",
    )
    parser.add_argument(
        "--rules-path",
        default="configs/pricing_rules_v1.json",
        help="Pricing rules config path.",
    )
    parser.add_argument(
        "--previous-price-column",
        default="offered_price",
        help="Column to use as previous published/displayed price.",
    )
    parser.add_argument(
        "--manual-override-price",
        type=float,
        default=None,
        help="Optional manual override final price.",
    )
    args = parser.parse_args()

    df = pd.read_csv(args.input_csv)
    if args.row_index < 0 or args.row_index >= len(df):
        raise IndexError(f"row-index {args.row_index} is out of bounds for {len(df)} rows.")

    raw_row = df.iloc[args.row_index]
    context = raw_row.to_dict()

    previous_price = None
    if args.previous_price_column in raw_row and pd.notna(raw_row[args.previous_price_column]):
        previous_price = float(raw_row[args.previous_price_column])

    engine = PriceEngine.from_artifacts(
        model_path=args.model_path,
        metadata_path=args.metadata_path,
        schema_path=args.schema_path,
        rules_path=args.rules_path,
    )
    recommendation = engine.recommend_price(
        context=context,
        previous_price=previous_price,
        manual_override_price=args.manual_override_price,
    )

    print("Input context key fields:")
    print(
        json.dumps(
            {
                "hotel_id": context.get("hotel_id"),
                "hotel_segment": context.get("hotel_segment"),
                "room_type_id": context.get("room_type_id"),
                "stay_date": context.get("stay_date"),
                "snapshot_date": context.get("snapshot_date"),
                "base_price": context.get("base_price"),
                "previous_price": previous_price,
            },
            indent=2,
            default=str,
        )
    )
    print("\nRecommendation:")
    print(json.dumps(recommendation, indent=2, default=str))


if __name__ == "__main__":
    main()
