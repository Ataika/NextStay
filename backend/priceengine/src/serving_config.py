import json
from pathlib import Path
from typing import Any


def load_json(path: str | Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def stable_hash_bucket(value: str, mod: int = 10_000) -> int:
    # Deterministic lightweight hash for rollout assignment.
    return sum((idx + 1) * ord(ch) for idx, ch in enumerate(value)) % mod


def should_route_to_dynamic_pricing(
    *,
    hotel_id: int,
    hotel_segment: str,
    stay_date: str,
    room_type_id: int,
    snapshot_date: str,
    rollout_config: dict[str, Any],
) -> bool:
    if not rollout_config.get("enabled", False):
        return True

    hotel_allowlist = set(rollout_config.get("hotel_allowlist", []))
    if hotel_allowlist and hotel_id not in hotel_allowlist:
        return False

    segment_allowlist = set(rollout_config.get("segment_allowlist", []))
    if segment_allowlist and hotel_segment not in segment_allowlist:
        return False

    fraction = float(rollout_config.get("traffic_fraction", 1.0))
    fraction = max(0.0, min(1.0, fraction))
    if fraction <= 0:
        return False
    if fraction >= 1:
        return True

    seed = int(rollout_config.get("seed", 42))
    key = f"{seed}|{hotel_id}|{hotel_segment}|{room_type_id}|{stay_date}|{snapshot_date}"
    bucket = stable_hash_bucket(key)
    threshold = int(fraction * 10_000)
    return bucket < threshold
