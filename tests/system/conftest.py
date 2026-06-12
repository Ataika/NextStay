"""System (end-to-end) test fixtures.

These tests run against the LIVE Dockerised stack (PMS + hotelsim on PostgreSQL),
not the in-memory unit suites. They are skipped automatically when the stack is
not reachable, so they never break unit CI.

Run them with the stack up:
    docker compose up -d db backend hotelsim
    backend/.venv/bin/python -m pytest tests/system -q
Env overrides: PMS_URL, SIM_URL, HOTEL_SYNC_TOKEN.
"""

from __future__ import annotations

import os

import httpx
import pytest

PMS = os.getenv("PMS_URL", "http://localhost:8000/api/v1")
SIM = os.getenv("SIM_URL", "http://localhost:8090")
TOKEN = os.getenv("HOTEL_SYNC_TOKEN", "dev-hotel-sync-token")
ADMIN = {"Authorization": "Bearer mock-admin-token"}


@pytest.fixture(scope="session", autouse=True)
def _require_stack():
    try:
        health = httpx.get(f"{PMS}/health", timeout=3.0)
        rooms = httpx.get(f"{SIM}/api/rooms", timeout=3.0)
    except Exception:
        pytest.skip("live stack not reachable — run `docker compose up -d db backend hotelsim`")
    if health.status_code != 200 or rooms.status_code != 200:
        pytest.skip("live stack not healthy")


@pytest.fixture
def client():
    with httpx.Client(timeout=10.0) as c:
        yield c
