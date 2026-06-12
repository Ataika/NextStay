"""Report content for NextStay — consumed by build_report.py (rep.* helpers)."""

from __future__ import annotations


def write_all(rep) -> None:
    intro(rep)
    agile(rep)
    requirements(rep)
    before_sprints(rep)
    sprints(rep)
    architecture(rep)
    tools(rep)
    features(rep)
    mockups(rep)
    data_bi_chapter(rep)


# --------------------------------------------------------------------------- #
def intro(rep):
    rep.h1("1. Introduction")
    rep.h2("1.1 Project Goals and Method")
    rep.p(
        "NextStay is a full-stack Property Management System (PMS) for small and mid-sized hotels. "
        "It automates the core operational loop — room inventory, guest booking, dynamic ML-based "
        "pricing, staff scheduling and housekeeping, payments, and a token-gated guest portal — and "
        "layers a data warehouse and BI dashboards on top for management analytics. The platform is "
        "built with Python/FastAPI on the backend, React/TypeScript/Vite on the frontend, and "
        "PostgreSQL with SQLAlchemy for persistence, following an Agile (Scrum) delivery method."
    )
    rep.h2("1.2 Project Background")
    rep.p(
        "Independent hotels often juggle several disconnected tools — a spreadsheet for rooms, a "
        "third-party booking channel, a chat group for housekeeping, and manual pricing. NextStay "
        "consolidates these into one integrated system with an ML-driven pricing engine and a "
        "synchronization layer that keeps the hotel's own website and the PMS in lock-step, removing "
        "the dependency on an expensive external PMS."
    )
    rep.h2("1.3 The Request of the Project")
    rep.p(
        "The brief was to build a secure web platform for hotel staff and guests: email-OTP login with "
        "JWT sessions and role-based access; room and inventory management; an AI-driven per-hotel "
        "pricing engine; staff shift scheduling with round-robin task delegation; Stripe payments; and a "
        "guest portal accessible by token without login. A further request added a two-way "
        "synchronization simulator between an external hotel website and the PMS."
    )
    rep.h2("1.4 Website Description")
    rep.p(
        "The application exposes five primary surfaces: the Admin dashboard (KPIs and management), the "
        "Booking portal (availability, holds, checkout), the Guest page (token-based stay details), the "
        "Staff planner (shifts and tasks), and the Pricing Lab (model training and published prices). "
        "Mock-ups are shown in Section 9."
    )


def agile(rep):
    rep.h1("2. Agile Methodology")
    rep.h2("2.1 Agile Framework Overview")
    rep.p(
        "Agile development favours short, iterative cycles that deliver working software frequently, with "
        "continuous feedback and the freedom to adapt scope. NextStay was delivered in five fixed-length "
        "sprints, each producing a demonstrable increment."
    )
    rep.h2("2.2 Motivation to Choose Scrum")
    rep.p(
        "Scrum fit a three-person student team well: clear roles, time-boxed sprints to force prioritisation, "
        "and a shared board for transparency. The vertical-slice nature of the features (each touching DB, "
        "backend, and frontend) mapped naturally to per-sprint goals."
    )
    rep.h2("2.3 Scrum Methodology")
    rep.p(
        "Roles: Product Owner (curates the backlog and acceptance), Scrum Master (removes blockers, guards "
        "the process), and the Development Team (Dair, Turat, Atai). Ceremonies: sprint planning, a short "
        "daily sync, a sprint review/demo, and a retrospective."
    )
    rep.h2("2.4 Scrum Implementation")
    rep.p(
        "Work was tracked on a GitHub-based task board; code moved to the main branch via pull requests "
        "gated by pre-commit (Ruff for Python, SQLFluff for SQL) and a CI workflow. Sprints were "
        "approximately ten working days each."
    )


def requirements(rep):
    rep.h1("3. Software Requirements")
    rep.h2("3.1 Functional Requirements")
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
            ["FR-13", "Multi-hotel registry + two-way hotel-site synchronization (HMAC)", "Atai"],
            ["FR-14", "Data warehouse (stg/core/mart) + BI dashboards", "Atai"],
        ],
    )
    rep.h2("3.2 Non-Functional Requirements")
    rep.bullets(
        [
            "Security: JWT sessions with JTI revocation, email-OTP, HMAC-signed sync webhooks, role-gated APIs.",
            "Performance: asynchronous pricing pipeline; indexed availability and payment lookups.",
            "Usability: role-gated UI; token-only guest access without an account.",
            "Maintainability: modular FastAPI routers, component-based frontend, "
            "dbt-managed warehouse, IaC via Docker Compose.",
            "Portability: SQL kept ANSI-compatible so dbt models run on both DuckDB (local) and PostgreSQL (prod).",
        ]
    )


def before_sprints(rep):
    rep.h1("4. Before Sprints")
    rep.h2("4.1 Definition of Done")
    rep.bullets(
        [
            "Code merged to main via pull request.",
            "No Ruff/SQLFluff lint errors (enforced by pre-commit + CI).",
            "Endpoints return the expected HTTP status codes; automated tests pass.",
            "UI renders without console errors.",
            "Feature manually tested end-to-end.",
        ]
    )
    rep.h2("4.2 Sprint Calendar")
    rep.table(
        ["Sprint", "Theme", "Length"],
        [
            ["Sprint 1", "Auth & User Foundation", "~10 days"],
            ["Sprint 2", "Rooms, Inventory & Booking Core", "~10 days"],
            ["Sprint 3", "Pricing Engine (ML)", "~12 days"],
            ["Sprint 4", "Staff, Shifts & Task Management", "~10 days"],
            ["Sprint 5", "Payments, Guest Portal & Polish", "~10 days"],
            ["Post-MVP", "Hotel-Sync Simulator, DWH, Airflow, Superset", "~10 days"],
        ],
    )
    rep.h2("4.3 Product Backlog")
    rep.p(
        "User stories were derived from FR-1…FR-14 and estimated in story points. Examples: "
        "“As a guest I can log in with an email OTP so that I can access the portal securely” (FR-1, 5pts); "
        "“As an owner I can train a per-hotel pricing model so that prices adapt to demand” (FR-6, 13pts); "
        "“As a manager I can see occupancy and RevPAR dashboards so that I can plan” (FR-14, 8pts)."
    )


def sprints(rep):
    rep.h1("5. Sprint Development & Results")

    def sprint(num, title, goal, rows):
        rep.h2(f"Sprint {num} — {title}")
        rep.p(f"Sprint goal: {goal}")
        rep.table(["Task", "Owner", "Days"], rows)

    sprint(
        1,
        "Auth & User Foundation",
        "any user can log in via email OTP and receive a JWT that gates all subsequent pages.",
        [
            ["[DB] users, auth_sessions, email_otp tables", "Atai", "2"],
            ["[DB] SQLAlchemy models: User, AuthSession, EmailOtp", "Atai", "2"],
            ["[DB] DB session factory + initial migration", "Atai", "1"],
            ["[BE] OTP request/verify, HMAC signing, expiry", "Dair", "3"],
            ["[BE] JWT issue + get_current_user dependency", "Dair", "2"],
            ["[BE] Role-based permission guards", "Dair", "1"],
            ["[FE] Login page + OTP form", "Turat", "2"],
            ["[FE] authStore (Zustand) + token persistence", "Turat", "1"],
            ["[FE] ProtectedRoute + role redirect", "Turat", "2"],
        ],
    )
    sprint(
        2,
        "Rooms, Inventory & Booking Core",
        "a guest can browse rooms, hold one, and complete a booking.",
        [
            ["[DB] rooms, bookings, guest_tokens models", "Atai", "2"],
            ["[DB] FK constraints + indexes on room_id, check_in/out", "Atai", "1"],
            ["[BE] Room CRUD endpoints", "Dair", "2"],
            ["[BE] Inventory setup + availability logic", "Dair", "2"],
            ["[BE] Booking create/confirm/cancel + hold system", "Dair", "3"],
            ["[FE] BookingPage / Success / Cancel, RoomCard", "Turat", "6"],
        ],
    )
    sprint(
        3,
        "Pricing Engine (ML)",
        "admin can train a per-hotel model, publish dynamic prices, and view them in the Pricing Lab.",
        [
            ["[DB] Pricing tables (config, model registry, jobs)", "Atai", "3"],
            ["[DB] Synthetic data generation script", "Atai", "2"],
            ["[BE] Feature engineering + training pipeline", "Dair", "3"],
            ["[BE] Optimizer + rules engine + Pricing Lab API", "Dair", "4"],
            ["[FE] PricingLab / ModelTraining / EngineHub pages", "Turat", "6"],
        ],
    )
    sprint(
        4,
        "Staff, Shifts & Task Management",
        "managers schedule shifts, tasks auto-assign round-robin, staff start their shifts.",
        [
            ["[DB] tasks table + staff fields; shift session model", "Atai", "3"],
            ["[BE] Staff CRUD + shift start/end + round-robin tasks", "Dair", "5"],
            ["[FE] StaffPlanner / Staff / ShiftStart / TaskCard", "Turat", "6"],
        ],
    )
    sprint(
        5,
        "Payments, Guest Portal & Polish",
        "end-to-end paid booking; guest receives email; token portal; admin reports.",
        [
            ["[DB] Stripe fields on bookings; OTP seeding/cleanup", "Atai", "2"],
            ["[BE] Stripe checkout + webhook; email service; /guest", "Dair", "5"],
            ["[FE] GuestPage / AdminPage / ReportsPage / Settings", "Turat", "8"],
        ],
    )
    rep.h2("Post-MVP — Hotel-Sync Simulator, DWH, Airflow & Superset (Atai)")
    rep.p(
        "Beyond the five MVP sprints, the data layer was extended (see Chapter 10): a multi-hotel registry "
        "and a secure two-way synchronization simulator; a dbt data warehouse (staging → core dimensions + "
        "fact + SCD2 → analytics marts); Airflow orchestration of the ELT; and Superset dashboards. The "
        "whole pipeline was validated end-to-end on PostgreSQL."
    )


def architecture(rep):
    rep.h1("6. Project & Code Architecture")

    rep.h2("6.1 Class Diagram (core domain)")
    rep.figure(
        """classDiagram
class Hotel { +id +code +name +webhook_url +hmac_secret +active }
class Room { +id +hotel_id +number +category +status +price +capacity }
class Booking { +id +guest_name +guest_email +room_id +check_in +check_out +status +amount_paid }
class GuestToken { +token +booking_id +room_id +is_valid +access_status }
class CleaningTask { +id +room_id +status +priority +assigned_to }
class User { +id +email +role +password_hash +preferred_language }
class AuthSession { +id +user_id +token_jti +expires_at +revoked_at }
class EmailOtp { +id +email +code_hash +expires_at +attempts +used }
Hotel "1" --> "*" Room
Room "1" --> "*" Booking
Booking "1" --> "1" GuestToken
Room "1" --> "*" CleaningTask
User "1" --> "*" AuthSession
""",
        "Figure 6.1 — Core domain class diagram.",
    )

    rep.h2("6.2 Use Case Diagram")
    rep.figure(
        """flowchart LR
  Guest([Guest]) --> UC1((Browse & book room))
  Guest --> UC2((Access portal by token))
  Staff([Staff]) --> UC3((Start shift / do tasks))
  Manager([Manager]) --> UC4((Schedule shifts))
  Owner([Owner]) --> UC5((Train pricing model))
  Owner --> UC6((View dashboards))
  SysAdmin([SysAdmin]) --> UC7((Manage users & roles))
  ExtHotel([Hotel website]) --> UC8((Sync bookings))
""",
        "Figure 6.2 — Use case overview.",
    )

    rep.h2("6.3 Component Diagram")
    rep.figure(
        """flowchart TB
  subgraph FE[Frontend - React/TS/Vite]
    Router --> Pages --> UI[UI primitives]
  end
  subgraph BE[Backend - FastAPI]
    API[/api/v1 routers/] --> SVC[services] --> ORM[SQLAlchemy]
  end
  subgraph DATA[Data platform]
    PG[(PostgreSQL)] --> DBT[dbt stg/core/mart]
    AF[Airflow] --> DBT
    DBT --> SUP[Superset]
  end
  HS[hotelsim service]
  FE --> API
  ORM --> PG
  HS <-->|webhook + HMAC| API
""",
        "Figure 6.3 — System component diagram.",
    )

    rep.h2("6.4 Database Diagram (ER)")
    rep.figure(
        """erDiagram
  HOTELS ||--o{ ROOMS : has
  ROOMS ||--o{ BOOKINGS : "booked in"
  BOOKINGS ||--|| GUEST_TOKENS : grants
  ROOMS ||--o{ CLEANING_TASKS : needs
  USERS ||--o{ AUTH_SESSIONS : opens
  HOTELS ||--o{ HOTEL_SYNC_EVENTS : emits
  HOTELS ||--o{ HOTEL_CHANNEL_BOOKINGS : maps
  BOOKINGS ||--o{ HOTEL_CHANNEL_BOOKINGS : "external ref"
  HOTELS { int id PK string code string name string webhook_url }
  ROOMS { int id PK int hotel_id FK string number string status float price }
  BOOKINGS { int id PK int room_id FK string status float amount_paid }
""",
        "Figure 6.4 — OLTP entity-relationship diagram (public schema).",
    )

    rep.h2("6.5 Data Flow Diagrams")
    rep.figure(
        """sequenceDiagram
  autonumber
  participant G as Guest
  participant FE as Frontend
  participant API as Booking API
  participant DB as PostgreSQL
  G->>FE: pick room + dates
  FE->>API: POST /holds (10-min hold)
  API->>DB: check availability + write hold
  FE->>API: POST /bookings (+ Stripe session)
  API->>DB: create booking + guest token
  API-->>FE: confirmation + token link
""",
        "Figure 6.5a — Booking & hold flow.",
    )
    rep.figure(
        """sequenceDiagram
  autonumber
  participant U as User
  participant API as Auth API
  participant M as Email
  U->>API: request OTP (email)
  API->>M: send HMAC-signed code (expiry, attempts)
  U->>API: verify OTP
  API-->>U: JWT (JTI tracked in auth_sessions)
""",
        "Figure 6.5b — Email-OTP authentication flow.",
    )
    rep.figure(
        """flowchart LR
  OLTP[(bookings/rooms)] --> FE2[feature engineering]
  FE2 --> ML[ml.pricingdata]
  ML --> TR[training_jobs] --> REG[hotel_model_registry]
  REG --> DEC[price_decisions] --> PUB[published_prices] --> BE[booking engine]
""",
        "Figure 6.5c — ML pricing pipeline.",
    )

    rep.h2("6.6 Deployment Diagram")
    rep.figure(
        """flowchart TB
  subgraph Docker Compose
    db[(db: postgres:15 - 5433)]
    be[backend: FastAPI - 8000]
    fe[frontend: Vite - 5173]
    hs[hotelsim - 8090]
    af[airflow - 8080]
    sup[superset - 8088]
  end
  be --> db
  hs <--> be
  af --> db
  sup --> db
""",
        "Figure 6.6 — Local deployment (Docker Compose).",
    )


def tools(rep):
    rep.h1("7. Tools & Technologies Used")
    rep.table(
        ["Layer", "Technology"],
        [
            ["Backend", "Python 3.11/3.12, FastAPI, Uvicorn"],
            ["Auth", "JWT (python-jose), bcrypt/passlib, HMAC OTP"],
            ["ORM / Migrations", "SQLAlchemy, raw SQL migrations + startup bootstrap"],
            ["Database", "PostgreSQL 15 (prod), SQLite (tests), DuckDB (dbt local)"],
            ["ML / Pricing", "scikit-learn, pandas, numpy"],
            ["Payments", "Stripe"],
            ["Warehouse", "dbt Core (dbt-postgres / dbt-duckdb)"],
            ["Orchestration", "Apache Airflow"],
            ["BI", "Apache Superset"],
            ["Frontend", "React 19, TypeScript, Vite, Zustand, React Router"],
            ["Sync simulator", "FastAPI + SQLite + vanilla HTML/JS (hotelsim)"],
            ["CI / Hooks", "pre-commit, Ruff, SQLFluff, GitHub Actions, Docker Compose"],
        ],
    )


def features(rep):
    rep.h1("8. Features Implemented")
    rep.table(
        ["Feature", "Description", "Owner", "Sprint"],
        [
            ["OTP auth + JWT", "Passwordless login, role-gated sessions", "Dair/Atai", "1"],
            ["Room & inventory", "CRUD, availability, holds", "Dair/Atai", "2"],
            ["Booking + guest token", "Reserve, confirm, cancel; token portal", "Dair/Turat", "2/5"],
            ["ML pricing engine", "Per-hotel training, backtest, publish", "Dair/Atai", "3"],
            ["Staff & tasks", "Shifts, round-robin housekeeping", "Dair/Turat", "4"],
            ["Stripe payments", "Checkout session + webhook", "Dair", "5"],
            ["Hotel-sync simulator", "Two-way HMAC sync + mini-site", "Atai", "Post-MVP"],
            ["Data warehouse", "dbt stg/core/mart + SCD2", "Atai", "Post-MVP"],
            ["Airflow ELT", "Nightly dbt orchestration", "Atai", "Post-MVP"],
            ["Superset BI", "Occupancy / RevPAR / loyalty dashboards", "Atai", "Post-MVP"],
        ],
    )


def mockups(rep):
    rep.h1("9. Website Mock-ups")
    rep.h2("9.1 PC Browser View")
    rep.p(
        "Admin dashboard, Booking portal, Guest page, and Staff planner on desktop. "
        "[Insert screenshots — capture from the running app at localhost:5173.]"
    )
    rep.h2("9.2 Mobile View")
    rep.p("Responsive layouts for the booking and guest flows. [Insert mobile screenshots — narrow-viewport captures.]")


def data_bi_chapter(rep):
    rep.h1("10. Data Architecture, Synchronization & BI (Atai)")
    rep.p(
        "This chapter details the data layer: the six-schema architecture, the multi-hotel "
        "synchronization simulator, the dbt data warehouse, Airflow orchestration, and Superset BI."
    )

    rep.h2("10.1 Six-Schema Architecture")
    rep.bullets(
        [
            "public — OLTP source of truth (rooms, bookings, holds, tasks, guest_tokens, users, hotels, sync tables).",
            "stg — staging mirror with ETL technical columns.",
            "core — dimensional warehouse (dim_dates/hotels/room_types/rooms/guests, fct_bookings, SCD2 snapshot).",
            "mart — analytics marts (occupancy, RevPAR, loyalty).",
            "ml — feature-engineered pricing dataset.",
            "pricing — pricing engine tables (snapshots, decisions, published prices, model registry, jobs, config).",
        ]
    )

    rep.h2("10.2 Hotel-Site Synchronization (multi-hotel, two-way, HMAC)")
    rep.p(
        "A standalone hotelsim service plays the role of an external hotel website. Bookings made there are "
        "pushed to the PMS as HMAC-signed webhook events; PMS-side changes (e.g. a cancellation) are pushed "
        "back to the hotel. Idempotency is enforced by a unique event id; anti-echo is guaranteed by "
        "call-site separation (inbound writes never re-publish)."
    )
    rep.figure(
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
        "Figure 10.1 — Inbound sync: hotel website → PMS.",
    )
    rep.figure(
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
        "Figure 10.2 — Outbound sync: PMS → hotel website (anti-echo).",
    )

    rep.h2("10.3 Data Warehouse (dbt)")
    rep.p(
        "dbt transforms the OLTP source into a dimensional model. Staging reads live public.* tables on the "
        "PostgreSQL target (and CSV seeds on the DuckDB local target). Core builds conformed dimensions, a "
        "booking-grain fact, and a SCD2 snapshot of room price/status history. Marts compute occupancy, "
        "RevPAR, and guest loyalty. The build is fully tested (unique / not-null / relationships / "
        "accepted-values / a custom occupancy-range test) — 49 checks pass on both targets."
    )
    rep.figure(
        """flowchart LR
  OLTP[(public: rooms/bookings/hotels)] --> STG[stg_* views]
  STG --> DIMS[core: dim_dates/hotels/room_types/rooms/guests]
  STG --> FCT[core: fct_bookings]
  STG --> SCD[core: scd_rooms - SCD2]
  DIMS --> MART
  FCT --> MART[mart: occupancy / revpar / loyalty]
  MART --> SUP[Superset dashboards]
""",
        "Figure 10.3 — Warehouse data flow (OLTP → stg → core → mart → BI).",
    )

    rep.h2("10.4 Orchestration (Airflow)")
    rep.p(
        "An Airflow DAG (nextstay_dbt_elt) runs the warehouse build nightly against PostgreSQL as a linear "
        "pipeline. It was validated with `airflow dags test`: all tasks succeeded and dbt's data tests passed."
    )
    rep.figure(
        """flowchart LR
  S[dbt seed] --> R[dbt run] --> SN[dbt snapshot] --> T[dbt test]
""",
        "Figure 10.4 — Airflow ELT DAG (nextstay_dbt_elt).",
    )

    rep.h2("10.5 Business Intelligence (Superset)")
    rep.p(
        "Superset connects to the warehouse and exposes the marts as datasets, surfaced on the "
        "“NextStay — Hotel Analytics” dashboard: occupancy by date, RevPAR by date, and guest loyalty "
        "tiers. [Insert dashboard screenshot from localhost:8088.]"
    )

    rep.h2("10.6 End-to-End Validation")
    rep.p(
        "The full stack was brought up with Docker Compose (db, backend, hotelsim, airflow, superset) and "
        "exercised end-to-end: a booking made on the hotel website appeared in the PMS with a channel "
        "mapping and a processed sync event; a cancellation in the PMS propagated back to the hotel site; "
        "duplicate events were ignored idempotently; an invalid token/signature was rejected with HTTP 401; "
        "and the dbt warehouse rebuilt green on PostgreSQL, feeding the Superset dashboards."
    )
