#!/usr/bin/env python3
"""Capture report screenshots from the running stack via headless system Chrome.

Targets that need no login or use known creds:
  - hotel-site simulator   http://localhost:8090       (no login)
  - Superset dashboard     http://localhost:8088       (admin / admin)
  - Airflow DAG graph      http://localhost:8080       (admin / $AIRFLOW_ADMIN_PW)

Outputs PNGs into scripts/report/screenshots/ (embedded into the report).
"""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "screenshots"
AIRFLOW_PW = os.getenv("AIRFLOW_ADMIN_PW", "")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        results = {}

        # 1) hotel-site simulator (vanilla JS — give fetch time to render)
        try:
            page.goto("http://localhost:8090/", wait_until="networkidle", timeout=20000)
            page.wait_for_timeout(2000)
            page.screenshot(path=str(OUT / "hotelsim.png"))
            results["hotelsim"] = "ok"
        except Exception as e:
            results["hotelsim"] = f"fail: {e}"

        # 2) Superset dashboard (login admin/admin)
        try:
            page.goto("http://localhost:8088/login/", wait_until="networkidle", timeout=20000)
            page.fill("#username", "admin")
            page.fill("#password", "admin")
            page.click('button[type="submit"], input[type="submit"]')
            page.wait_for_timeout(2000)
            page.goto("http://localhost:8088/superset/dashboard/1/", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(5000)
            page.screenshot(path=str(OUT / "superset.png"), full_page=True)
            results["superset"] = "ok"
        except Exception as e:
            results["superset"] = f"fail: {e}"

        # 3) Airflow DAG graph (login admin / generated pw)
        try:
            page.goto("http://localhost:8080/login/", wait_until="networkidle", timeout=20000)
            page.fill('input[name="username"]', "admin")
            page.fill('input[name="password"]', AIRFLOW_PW)
            page.click('input[type="submit"], button[type="submit"]')
            page.wait_for_timeout(2000)
            page.goto("http://localhost:8080/dags/nextstay_dbt_elt/graph", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(4000)
            page.screenshot(path=str(OUT / "airflow.png"))
            results["airflow"] = "ok"
        except Exception as e:
            results["airflow"] = f"fail: {e}"

        browser.close()
        for k, v in results.items():
            print(f"{k}: {v}")


if __name__ == "__main__":
    main()
