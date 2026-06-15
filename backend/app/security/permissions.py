"""Role-based permission helpers for hotel operations."""

from __future__ import annotations

from fastapi import HTTPException, status

# Roles that can access the admin panel and manage day-to-day hotel operations.
HOTEL_ADMIN_ROLES: frozenset[str] = frozenset({"OWNER", "MANAGER", "SYS_ADMIN", "DIRECTOR"})

# Owner and manager share most operational permissions.
HOTEL_OPERATIONS_ROLES: frozenset[str] = frozenset({"OWNER", "MANAGER"})

# Legacy engine / pricing management (unchanged).
ENGINE_MANAGE_ROLES: frozenset[str] = frozenset({"OWNER", "SYS_ADMIN"})

ASSIGNABLE_USER_ROLES: frozenset[str] = frozenset({"STAFF", "MANAGER"})
PROTECTED_USER_ROLES: frozenset[str] = frozenset({"OWNER", "SYS_ADMIN"})


def normalize_role(role: str | None) -> str:
    return (role or "").strip().upper()


def is_owner(role: str | None) -> bool:
    return normalize_role(role) == "OWNER"


def is_manager(role: str | None) -> bool:
    return normalize_role(role) == "MANAGER"


def can_access_hotel_admin(role: str | None) -> bool:
    return normalize_role(role) in HOTEL_ADMIN_ROLES


def can_manage_hotel_operations(role: str | None) -> bool:
    """Shared owner/manager access for staff, tasks, schedules, bookings."""
    return normalize_role(role) in HOTEL_OPERATIONS_ROLES or normalize_role(role) in {"SYS_ADMIN", "DIRECTOR"}


def can_invite_staff(role: str | None) -> bool:
    return can_manage_hotel_operations(role)


def can_invite_manager(role: str | None) -> bool:
    return is_owner(role)


def can_change_user_role(actor_role: str | None) -> bool:
    return is_owner(actor_role)


def can_delete_user_account(actor_role: str | None) -> bool:
    return is_owner(actor_role)


def can_manage_engine(role: str | None) -> bool:
    return normalize_role(role) in ENGINE_MANAGE_ROLES


def assert_can_invite_role(actor_role: str | None, target_role: str) -> None:
    target = normalize_role(target_role)
    if target not in ASSIGNABLE_USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {sorted(ASSIGNABLE_USER_ROLES)}",
        )
    if target == "MANAGER" and not can_invite_manager(actor_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the hotel owner can create or assign manager accounts.",
        )
    if not can_invite_staff(actor_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")


def assert_can_change_role(actor_role: str | None, target_current_role: str, target_new_role: str) -> None:
    if not can_change_user_role(actor_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the hotel owner can change user roles.")
    current = normalize_role(target_current_role)
    new_role = normalize_role(target_new_role)
    if current in PROTECTED_USER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account role cannot be changed.")
    if new_role not in ASSIGNABLE_USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {sorted(ASSIGNABLE_USER_ROLES)}",
        )
    if new_role == "MANAGER" and not can_invite_manager(actor_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the hotel owner can assign the manager role."
        )


def assert_can_delete_user(actor_role: str | None, target_role: str, *, actor_id: int, target_id: int) -> None:
    if not can_delete_user_account(actor_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the hotel owner can delete user accounts."
        )
    if actor_id == target_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account.")
    if normalize_role(target_role) in PROTECTED_USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Owner and system accounts cannot be deleted."
        )
