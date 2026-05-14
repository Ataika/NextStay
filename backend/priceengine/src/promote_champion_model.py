import argparse
import json
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote winner model to champion aliases.")
    parser.add_argument(
        "--winner-json",
        default="outputs/model_comparison_winner.json",
        help="Winner summary JSON from model comparison.",
    )
    parser.add_argument(
        "--artifacts-dir",
        default="artifacts",
        help="Artifacts directory where model files live.",
    )
    args = parser.parse_args()

    artifacts_dir = Path(args.artifacts_dir)
    winner_path = Path(args.winner_json)

    if not winner_path.exists():
        raise FileNotFoundError(f"Winner file not found: {winner_path}")

    winner = json.loads(winner_path.read_text(encoding="utf-8"))
    winner_model = winner["winner_model"]

    source_model = artifacts_dir / f"{winner_model}.pkl"
    source_metadata = artifacts_dir / f"{winner_model}_metadata.json"
    if not source_model.exists():
        raise FileNotFoundError(f"Winner model artifact missing: {source_model}")
    if not source_metadata.exists():
        raise FileNotFoundError(f"Winner metadata artifact missing: {source_metadata}")

    champion_model = artifacts_dir / "champion_model.pkl"
    champion_metadata = artifacts_dir / "champion_model_metadata.json"

    shutil.copy2(source_model, champion_model)
    shutil.copy2(source_metadata, champion_metadata)

    promotion_record = {
        "promoted_model": winner_model,
        "source_model": str(source_model),
        "source_metadata": str(source_metadata),
        "champion_model": str(champion_model),
        "champion_metadata": str(champion_metadata),
        "selection_metric": winner.get("selection_metric", "unknown"),
    }
    record_path = artifacts_dir / "champion_promotion_record.json"
    record_path.write_text(json.dumps(promotion_record, indent=2), encoding="utf-8")

    print("Champion promotion completed.")
    print(json.dumps(promotion_record, indent=2))


if __name__ == "__main__":
    main()
