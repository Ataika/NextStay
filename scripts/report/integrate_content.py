"""Content of the chapters appended into soft.docx (see integrate_into_soft.py).

Chapter numbers continue the base report (which ends at 12. Conclusions):
  13. Data Architecture, Synchronization & BI
  14. Extended System Testing
"""

from __future__ import annotations


def add_chapters(doc, h):
    ch, sub, body, bullets, table, figure = (
        h["chapter"],
        h["subsection"],
        h["body"],
        h["bullets"],
        h["table"],
        h["figure"],
    )

    # --------------------------------------------------------------- Chapter 13
    ch(doc, "13. Data Architecture, Synchronization & Business Intelligence")
    body(
        doc,
        "This chapter documents the data-platform work added on top of the MVP: a six-schema database "
        "architecture, a multi-hotel two-way synchronization simulator, a dbt data warehouse, Airflow "
        "orchestration of the ELT, and Superset dashboards. It complements Chapter 7 (System Architecture).",
    )

    sub(doc, "13.1 Six-Schema Database Architecture")
    bullets(
        doc,
        [
            "public — OLTP source of truth (rooms, bookings, holds, tasks, guest_tokens, users, hotels, sync tables).",
            "stg — staging mirror with ETL technical columns.",
            "core — dimensional warehouse (dim_dates/hotels/room_types/rooms/guests, fct_bookings, SCD2 snapshot).",
            "mart — analytics marts (occupancy, RevPAR, loyalty).",
            "ml — feature-engineered pricing dataset.",
            "pricing — pricing engine tables (snapshots, decisions, published prices, registry, jobs, config).",
        ],
    )
    figure(
        doc,
        """erDiagram
  HOTELS ||--o{ ROOMS : has
  ROOMS ||--o{ BOOKINGS : "booked in"
  BOOKINGS ||--|| GUEST_TOKENS : grants
  ROOMS ||--o{ CLEANING_TASKS : needs
  HOTELS ||--o{ HOTEL_SYNC_EVENTS : emits
  HOTELS ||--o{ HOTEL_CHANNEL_BOOKINGS : maps
  BOOKINGS ||--o{ HOTEL_CHANNEL_BOOKINGS : "external ref"
  HOTELS { int id PK string code string webhook_url }
  ROOMS { int id PK int hotel_id FK string number string status float price }
  BOOKINGS { int id PK int room_id FK string status float amount_paid }
""",
        "Figure 13.1 — OLTP ER diagram (with multi-hotel + sync tables).",
    )

    sub(doc, "13.2 Hotel-Site Synchronization (multi-hotel, two-way, HMAC)")
    body(
        doc,
        "A standalone hotelsim service plays the role of an external hotel website. Bookings made there are "
        "pushed to the PMS as HMAC-signed webhook events; PMS-side changes (e.g. a cancellation) are pushed "
        "back. Idempotency is enforced by a unique event id; anti-echo by call-site separation (inbound "
        "writes never re-publish).",
    )
    figure(
        doc,
        """sequenceDiagram
  autonumber
  participant Site as Hotel website (hotelsim)
  participant API as PMS /hotel-sync/events
  participant DB as PostgreSQL
  Site->>API: booking_created (X-NextStay-Signature)
  API->>API: verify HMAC + dedupe by event_id
  API->>DB: create booking + guest token + channel mapping
  API-->>Site: synchronized booking id
""",
        "Figure 13.2 — Inbound sync: hotel website → PMS.",
    )
    figure(
        doc,
        """sequenceDiagram
  autonumber
  participant Admin as PMS Admin
  participant API as Bookings API
  participant Pub as sync_publisher
  participant Site as Hotel website (hotelsim)
  Admin->>API: PATCH booking = Cancelled
  API->>Pub: PMS-origin change (has channel mapping)
  Pub->>Site: signed booking_cancelled webhook
  Site->>Site: verify HMAC + cancel local booking
""",
        "Figure 13.3 — Outbound sync: PMS → hotel website (anti-echo).",
    )

    sub(doc, "13.3 Data Warehouse (dbt)")
    body(
        doc,
        "dbt transforms OLTP into a dimensional model: staging reads live public.* on PostgreSQL (and CSV "
        "seeds on the DuckDB local target); core builds conformed dimensions, a booking-grain fact and a "
        "SCD2 room snapshot; marts compute occupancy, RevPAR and loyalty. 49 dbt tests pass on both targets.",
    )
    figure(
        doc,
        """flowchart LR
  OLTP[(public: rooms/bookings/hotels)] --> STG[stg_* views]
  STG --> DIMS[core: dim_dates/hotels/room_types/rooms/guests]
  STG --> FCT[core: fct_bookings]
  STG --> SCD[core: scd_rooms - SCD2]
  DIMS --> MART
  FCT --> MART[mart: occupancy / revpar / loyalty]
  MART --> SUP[Superset dashboards]
""",
        "Figure 13.4 — Warehouse data flow (OLTP → stg → core → mart → BI).",
    )

    sub(doc, "13.4 Orchestration (Airflow)")
    body(
        doc,
        "The Airflow DAG nextstay_dbt_elt runs the warehouse build nightly on PostgreSQL as a linear "
        "pipeline. Validated via `airflow dags test`: all tasks succeeded and dbt's data tests passed.",
    )
    figure(
        doc,
        """flowchart LR
  S[dbt seed] --> R[dbt run] --> SN[dbt snapshot] --> T[dbt test]
""",
        "Figure 13.5 — Airflow ELT DAG (nextstay_dbt_elt).",
    )

    sub(doc, "13.5 Business Intelligence (Superset)")
    body(
        doc,
        "Superset connects to the warehouse and exposes the marts as datasets on the 'NextStay — Hotel "
        "Analytics' dashboard: occupancy by date, RevPAR by date, and guest loyalty tiers. "
        "[INSERT SCREENSHOT: Superset dashboard from http://localhost:8088 — see notes.]",
    )

    sub(doc, "13.6 End-to-End Validation")
    body(
        doc,
        "The full stack (db, backend, hotelsim, airflow, superset) was exercised end-to-end on PostgreSQL: a "
        "booking on the hotel website appeared in the PMS with a channel mapping and a processed sync event; "
        "a PMS cancellation propagated back to the hotel site; duplicate events were ignored idempotently; an "
        "invalid token/signature was rejected with HTTP 401; and dbt rebuilt green, feeding Superset.",
    )

    # --------------------------------------------------------------- Chapter 14
    ch(doc, "14. Extended System Testing")
    body(
        doc,
        "Building on the testing described in Chapter 6, the platform is covered by a four-layer test "
        "pyramid totalling 167 automated checks — all green.",
    )
    figure(
        doc,
        """flowchart TB
  E2E["System / E2E (4) - live Docker stack via httpx"]
  DATA["Data tests (49) - dbt"]
  INT["Integration (114) - FastAPI TestClient + SQLite"]
  UNIT["Unit - HMAC, publisher, generator, task state machine"]
  E2E --> DATA --> INT --> UNIT
""",
        "Figure 14.1 — Test pyramid (counts as of the latest run).",
    )

    sub(doc, "14.1 Test Inventory")
    table(
        doc,
        ["Layer", "Scope", "Tooling", "Count"],
        [
            ["Integration", "Backend API + DB", "pytest + TestClient + SQLite", "101"],
            ["Integration", "Hotel simulator", "pytest + TestClient", "13"],
            ["Data quality", "Warehouse keys/FKs/ranges", "dbt test", "49"],
            ["System / E2E", "Bidirectional sync, idempotency, auth", "pytest + httpx", "4"],
            ["Total", "Automated checks", "—", "167"],
        ],
        caption="Test inventory across the pyramid.",
    )

    sub(doc, "14.2 System (End-to-End) Test Cases")
    table(
        doc,
        ["#", "Scenario", "Expected result"],
        [
            ["E2E-1", "Guest books on the hotel website", "Booking + active channel mapping appear in the PMS"],
            ["E2E-2", "Admin cancels the booking in the PMS", "Signed webhook cancels the booking on the hotel site"],
            ["E2E-3", "Same sync event delivered twice", "Second is ignored (duplicate_event_ignored); no dup"],
            ["E2E-4", "Event sent with an invalid sync token", "Rejected with HTTP 401"],
        ],
        caption="System (end-to-end) test cases (tests/system/test_e2e_hotel_sync.py).",
    )

    sub(doc, "14.3 Requirements Traceability")
    table(
        doc,
        ["FR", "Sprint", "Verified by", "Owner"],
        [
            ["FR-1", "1", "Integration (test_auth)", "Dair"],
            ["FR-3/4", "2", "Integration (rooms/bookings)", "Dair"],
            ["FR-6", "3", "Unit + priceengine tests", "Dair"],
            ["FR-7", "4", "Integration (staff/tasks)", "Dair"],
            ["FR-8…12", "2–5", "Frontend tests (planned, #45)", "Turat"],
            ["FR-13", "Post-MVP", "Integration + System E2E", "Atai"],
            ["FR-14", "Post-MVP", "dbt data tests (49) + freshness", "Atai"],
        ],
        caption="Requirements traceability (FR → sprint → test → owner).",
    )
