#!/usr/bin/env python3
"""Bootstrap Superset for NextStay: DB connection + mart datasets + charts + dashboard.

Idempotent-ish: skips entities that already exist by name. Run after Superset is
initialised (admin user created). Targets the marts dbt built on Postgres
(schema `stg_mart`: mart_occupancy / mart_revpar / mart_loyalty).

Usage:
  python scripts/bootstrap_superset.py
Env (defaults shown):
  SUPERSET_URL=http://localhost:8088  SUPERSET_USER=admin  SUPERSET_PASS=admin
  PG_URI=postgresql://nextstay:nextstay@db:5432/nextstay   (from Superset's POV)
  MART_SCHEMA=stg_mart
"""

from __future__ import annotations

import json
import os
import sys

import httpx

BASE = os.getenv("SUPERSET_URL", "http://localhost:8088").rstrip("/")
USER = os.getenv("SUPERSET_USER", "admin")
PASSWORD = os.getenv("SUPERSET_PASS", "admin")
PG_URI = os.getenv("PG_URI", "postgresql://nextstay:nextstay@db:5432/nextstay")
SCHEMA = os.getenv("MART_SCHEMA", "stg_mart")
DB_NAME = "NextStay Warehouse"


def main() -> int:
    client = httpx.Client(base_url=BASE, timeout=30.0)

    # 1) login -> JWT
    r = client.post(
        "/api/v1/security/login",
        json={"username": USER, "password": PASSWORD, "provider": "db", "refresh": True},
    )
    r.raise_for_status()
    token = r.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    # 2) CSRF (needed for write ops); keep cookies on the same client
    r = client.get("/api/v1/security/csrf_token/")
    r.raise_for_status()
    client.headers["X-CSRFToken"] = r.json()["result"]
    client.headers["Referer"] = BASE

    def find(path: str, col: str, value: str):
        q = {"filters": [{"col": col, "opr": "eq", "value": value}]}
        resp = client.get(f"/api/v1/{path}/", params={"q": json.dumps(q)})
        resp.raise_for_status()
        data = resp.json()
        if data.get("count"):
            return data["ids"][0] if data.get("ids") else data["result"][0]["id"]
        return None

    # 3) database connection
    db_id = find("database", "database_name", DB_NAME)
    if db_id:
        print(f"DB exists id={db_id}")
    else:
        r = client.post(
            "/api/v1/database/",
            json={
                "database_name": DB_NAME,
                "sqlalchemy_uri": PG_URI,
                "expose_in_sqllab": True,
            },
        )
        r.raise_for_status()
        db_id = r.json()["id"]
        print(f"DB created id={db_id}")

    # 4) datasets on the mart tables
    marts = ["mart_occupancy", "mart_revpar", "mart_loyalty"]
    ds_ids: dict[str, int] = {}
    for table in marts:
        existing = find("dataset", "table_name", table)
        if existing:
            ds_ids[table] = existing
            print(f"dataset {table} exists id={existing}")
            continue
        r = client.post(
            "/api/v1/dataset/",
            json={"database": db_id, "schema": SCHEMA, "table_name": table},
        )
        if r.status_code not in (200, 201):
            print(f"dataset {table} FAILED {r.status_code}: {r.text[:300]}")
            continue
        ds_ids[table] = r.json()["id"]
        print(f"dataset {table} created id={ds_ids[table]}")

    # 5) charts (robust 'table' viz — minimal params)
    chart_specs = [
        ("Occupancy by date", "mart_occupancy", ["date_key", "hotel_id", "occupancy_rate", "occupied_rooms"]),
        ("RevPAR by date", "mart_revpar", ["date_key", "hotel_id", "revpar", "room_revenue"]),
        ("Guest loyalty", "mart_loyalty", ["guest_email", "loyalty_tier", "realized_bookings", "lifetime_value"]),
    ]
    chart_ids: list[int] = []
    for name, table, cols in chart_specs:
        if table not in ds_ids:
            continue
        existing = find("chart", "slice_name", name)
        if existing:
            chart_ids.append(existing)
            print(f"chart '{name}' exists id={existing}")
            continue
        params = {
            "viz_type": "table",
            "query_mode": "raw",
            "all_columns": cols,
            "row_limit": 1000,
        }
        r = client.post(
            "/api/v1/chart/",
            json={
                "slice_name": name,
                "viz_type": "table",
                "datasource_id": ds_ids[table],
                "datasource_type": "table",
                "params": json.dumps(params),
            },
        )
        if r.status_code not in (200, 201):
            print(f"chart '{name}' FAILED {r.status_code}: {r.text[:300]}")
            continue
        chart_ids.append(r.json()["id"])
        print(f"chart '{name}' created id={chart_ids[-1]}")

    # 6) dashboard with the charts
    dash_title = "NextStay — Hotel Analytics"
    dash_id = find("dashboard", "dashboard_title", dash_title)
    if not dash_id:
        r = client.post(
            "/api/v1/dashboard/",
            json={"dashboard_title": dash_title, "published": True},
        )
        if r.status_code in (200, 201):
            dash_id = r.json()["id"]
            print(f"dashboard created id={dash_id}")
        else:
            print(f"dashboard FAILED {r.status_code}: {r.text[:300]}")
    else:
        print(f"dashboard exists id={dash_id}")

    # attach charts to the dashboard + lay them out (position_json) so they render
    if dash_id and chart_ids:
        for cid in chart_ids:
            client.put(f"/api/v1/chart/{cid}", json={"dashboards": [dash_id]})
        layout = {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
            "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": ["ROW-1"], "parents": ["ROOT_ID"]},
            "ROW-1": {
                "type": "ROW",
                "id": "ROW-1",
                "meta": {"background": "BACKGROUND_TRANSPARENT"},
                "children": [f"CHART-{cid}" for cid in chart_ids],
                "parents": ["ROOT_ID", "GRID_ID"],
            },
        }
        for cid in chart_ids:
            layout[f"CHART-{cid}"] = {
                "type": "CHART",
                "id": f"CHART-{cid}",
                "children": [],
                "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
                "meta": {"chartId": cid, "width": 4, "height": 60},
            }
        client.put(f"/api/v1/dashboard/{dash_id}", json={"position_json": json.dumps(layout)})
        print(f"attached + laid out {len(chart_ids)} charts on dashboard {dash_id}")

    print("DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
