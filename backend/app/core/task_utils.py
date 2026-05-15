"""Round-robin auto-assignment of cleaning tasks to active cleaners."""

from app.models.task import CleaningTask as TaskModel
from sqlalchemy import text
from sqlalchemy.orm import Session


def round_robin_assign(db: Session) -> tuple[int | None, str | None]:
    """Return (staff_id, staff_name) for the next cleaner in round-robin order.

    Picks the active cleaner who follows the last-assigned cleaner by ID.
    Returns (None, None) if no active cleaners exist.
    """
    rows = db.execute(
        text("SELECT id, name FROM staff_members WHERE role = 'cleaner' AND is_active = TRUE ORDER BY id")
    ).fetchall()

    if not rows:
        return None, None

    cleaner_ids = [r.id for r in rows]

    last = (
        db.query(TaskModel).filter(TaskModel.assigned_to.in_(cleaner_ids)).order_by(TaskModel.created_at.desc()).first()
    )

    if not last or last.assigned_to not in cleaner_ids:
        next_row = rows[0]
    else:
        idx = cleaner_ids.index(last.assigned_to)
        next_row = rows[(idx + 1) % len(rows)]

    return next_row.id, next_row.name
