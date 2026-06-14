"""Full report content: reuse soft.docx prose for the chapters the team wrote
(Introduction, Software Requirements), author everything else, embed all diagrams
and the live screenshots, and add an appendix of key listings.
"""

from __future__ import annotations

from pathlib import Path

SHOTS = Path(__file__).resolve().parent / "screenshots"


def write_full(rep):
    from scripts.report import content as C
    from scripts.report import soft_prose as SP

    # 1. Introduction — reuse the base document's prose
    rep.h1("1. Introduction")
    SP.emit(rep, "1. INTRODUCTION", "3. SOFTWARE REQUIREMENTS")

    # 2. Agile / Project Management Methodology — authored
    C.agile(rep)

    # 3. Software Requirements — reuse base prose + consolidated summary tables
    rep.h1("3. Software Requirements")
    SP.emit(rep, "3. SOFTWARE REQUIREMENTS", "4. BEFORE SPRINTS")
    rep.h2("3.3 Consolidated Requirements & Data-Platform Additions")
    rep.table(
        ["#", "Requirement", "Owner"],
        [
            ["FR-1", "Email OTP login + JWT session management", "Dair"],
            ["FR-2", "Role-based access (OWNER, STAFF, MANAGER, DIRECTOR, SYS_ADMIN)", "Dair + Atai"],
            ["FR-3", "Room CRUD + inventory setup", "Dair"],
            ["FR-4", "Guest booking flow with availability check + holds", "Dair"],
            ["FR-5", "Stripe payment integration", "Dair"],
            ["FR-6", "Per-hotel ML pricing engine (training, backtesting, publishing)", "Dair"],
            ["FR-7", "Staff management + shift system + round-robin task assignment", "Dair"],
            ["FR-8", "Admin dashboard with all sub-pages", "Turat"],
            ["FR-9", "Guest portal (token-based, no login)", "Turat"],
            ["FR-10", "Booking pages (book, success, cancel)", "Turat"],
            ["FR-11", "Staff shift start / task views", "Turat"],
            ["FR-12", "Reports page", "Turat"],
            ["FR-13", "Multi-hotel registry + two-way hotel-site sync (HMAC)", "Atai"],
            ["FR-14", "Data warehouse (stg/core/mart) + BI dashboards", "Atai"],
        ],
        caption="Consolidated functional requirements (FR-1…FR-14).",
    )

    # 4–12 + Data/BI + Testing + Conclusion — authored chapters (already complete)
    C.before_sprints(rep)
    C.sprints(rep)
    C.architecture(rep)
    C.tools(rep)
    C.features(rep)

    C.mockups(rep)
    rep.image(SHOTS / "hotelsim.png", "Figure 9.1 — External hotel-site simulator (booking UI).")
    rep.p(
        "[INSERT SCREENSHOTS — frontend at http://localhost:5173 (after login): Admin dashboard, Booking "
        "page, Guest portal, Staff planner, Pricing Lab for §9.1 Desktop; narrow-viewport captures for §9.2 Mobile.]"
    )

    C.data_bi_chapter(rep)
    rep.image(SHOTS / "airflow.png", "Figure 10.7 — Airflow DAG nextstay_dbt_elt: all tasks succeeded.")
    rep.image(SHOTS / "superset.png", "Figure 10.8 — Superset dashboard 'NextStay — Hotel Analytics'.")

    C.testing(rep)
    C.conclusion(rep)
    appendix(rep)


def appendix(rep):
    rep.h1("Appendix A — Key Listings")

    rep.h2("A.1 OLTP schema (excerpt)")
    rep.code(
        "CREATE TABLE rooms (\n"
        "    id SERIAL PRIMARY KEY,\n"
        "    hotel_id INTEGER REFERENCES hotels (id),\n"
        "    number VARCHAR(10) NOT NULL,\n"
        "    category VARCHAR(50) NOT NULL,\n"
        "    status VARCHAR(20) NOT NULL DEFAULT 'Available',\n"
        "    price FLOAT NOT NULL,\n"
        "    capacity INT NOT NULL DEFAULT 2,\n"
        "    CONSTRAINT uq_rooms_hotel_number UNIQUE (hotel_id, number)\n"
        ");"
    )

    rep.h2("A.2 HMAC sign / verify (hotel-sync security)")
    rep.code(
        "def sign_payload(raw_body: bytes, secret: str) -> str:\n"
        "    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()\n"
        "    return f\"sha256={digest}\"\n\n"
        "def verify_signature(raw_body, secret, provided) -> bool:\n"
        "    if not provided or not provided.startswith('sha256='):\n"
        "        return False\n"
        "    return hmac.compare_digest(sign_payload(raw_body, secret), provided)"
    )

    rep.h2("A.3 dbt mart — occupancy (excerpt)")
    rep.code(
        "select\n"
        "    a.hotel_id, a.date_key, a.available_rooms,\n"
        "    coalesce(o.occupied_rooms, 0) as occupied_rooms,\n"
        "    round(coalesce(o.occupied_rooms,0)*1.0 / nullif(a.available_rooms,0), 4) as occupancy_rate\n"
        "from available a\n"
        "left join occupied o on a.hotel_id=o.hotel_id and a.date_key=o.date_key"
    )

    rep.h2("A.4 Airflow ELT DAG (excerpt)")
    rep.code(
        "with DAG('nextstay_dbt_elt', schedule_interval='0 3 * * *', ...) as dag:\n"
        "    seed = BashOperator(task_id='dbt_seed', bash_command=DBT.format(cmd='seed'))\n"
        "    run = BashOperator(task_id='dbt_run', bash_command=DBT.format(cmd='run'))\n"
        "    snap = BashOperator(task_id='dbt_snapshot', bash_command=DBT.format(cmd='snapshot'))\n"
        "    test = BashOperator(task_id='dbt_test', bash_command=DBT.format(cmd='test'))\n"
        "    seed >> run >> snap >> test"
    )

    rep.h2("A.5 System E2E test (excerpt)")
    rep.code(
        "def test_booking_on_hotel_site_appears_in_pms(client):\n"
        "    ext = _book_on_site(client, room='101')\n"
        "    row = _pms_channel_row(client, ext)\n"
        "    assert row and row['status'] == 'active'\n"
        "    assert row['bookingId'] is not None"
    )
