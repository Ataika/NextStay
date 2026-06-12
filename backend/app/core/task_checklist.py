from __future__ import annotations

DEFAULT_CHECKLIST_LABELS = (
    "Cleaning room",
    "Change bedding",
    "Refill mini bar",
)


def build_checklist(labels: list[str] | None) -> list[dict]:
    source = [label.strip() for label in (labels or []) if label and label.strip()]
    if not source:
        source = list(DEFAULT_CHECKLIST_LABELS)
    return [{"id": str(index), "label": label, "checked": False} for index, label in enumerate(source)]


def ensure_checklist(checklist: list[dict] | None) -> list[dict]:
    if checklist:
        return checklist
    return build_checklist(None)


def all_items_checked(checklist: list[dict] | None) -> bool:
    items = ensure_checklist(checklist)
    return all(bool(item.get("checked")) for item in items)


def toggle_checklist_item(checklist: list[dict] | None, item_id: str, checked: bool) -> list[dict]:
    if not checklist:
        raise ValueError("Task has no checklist.")
    updated: list[dict] = []
    found = False
    for item in checklist:
        if str(item.get("id")) == str(item_id):
            updated.append({**item, "checked": checked})
            found = True
        else:
            updated.append(item)
    if not found:
        raise ValueError("Checklist item not found.")
    return updated
