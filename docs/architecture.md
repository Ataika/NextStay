System Architecture — NexStay OS
1. Technical Stack
Frontend: React.js + TypeScript + Tailwind CSS (Vite-based).

Backend: Python + FastAPI + SQLAlchemy (Asynchronous ORM).

Database: PostgreSQL 15 (Relational & Analytical storage).

Data Engineering: dbt Core (Transformation layer).

BI Platform: Apache Superset (Data Visualization).

Infrastructure: Docker & Docker Compose (Containerization).

2. System Components (SOA Approach)
NexStay OS follows a Service-Oriented Architecture (SOA), ensuring modularity and scalability:

Presentation Layer (Frontend): A responsive SPA providing dedicated interfaces for Admins, Managers, and Housekeeping staff.

Logic Layer (Backend): A FastAPI server managing business logic and Complex Algorithms (Category C). It orchestrates 3rd party integrations (Telegram, SMTP, PDF).

Data Layer (PostgreSQL): A centralized database acting as both an OLTP (Transactions) and OLAP (Data Warehouse) source.

Analytics Layer (dbt + Superset): An independent ELT pipeline that transforms raw operational data into analytical marts for real-time business intelligence.

3. Data Warehouse Design (Medallion Architecture)
To meet the "Complex Logic" requirements, the Data Layer is organized into three analytical stages:

Staging (STG): Raw data ingestion from the backend with audit metadata.

Core (DDS): A normalized model using Surrogate Keys and SCD Type 2 to track historical changes (e.g., room price history).

Mart: Analytical views optimized for KPI calculation (RevPAR, Occupancy Rates, and Loyalty Tiers).

4. Categorization of Functionalities (SE Project Rules)
According to the project guidelines, the system is balanced across three categories:

Category	Functionality	Implementation Detail
A (CRUD)	Room & Booking Management	Standard DB operations with SQLAlchemy.
B (3rd Party)	Multi-channel Alerts & Reporting	Telegram Bot API, SMTP Service, and ReportLab (PDF).
C (Complex)	Dynamic Pricing Engine	Algorithm adjusting prices based on occupancy/demand.
C (Complex)	Weighted Task Dispatcher	Priority-based algorithm for housekeeping optimization.
C (Complex)	Analytical Pipelines	Automated dbt transformations and revenue forecasting.
5. Deployment Architecture (Docker Compose)

The ecosystem is orchestrated via docker-compose.yml with isolated environments:

nextstay_db: PostgreSQL 15 (Port 5432).

nextstay_backend: FastAPI application (Port 8000).

nextstay_frontend: React TS application (Port 5173).

nextstay_dbt: Transformation engine (isolated container).

nextstay_superset: BI Platform (Port 8088).

6. Logic & Data Flow
Event: A Guest triggers a "Booking" on the Frontend.

Complex Logic: The Dynamic Pricing Engine (Backend) calculates the rate based on real-time supply/demand.

State Change: The Backend updates the Bookings table and generates a PDF Invoice (Category B).

ETL Transformation: The dbt pipeline (Analytics) processes the new data, moving it through STG -> CORE -> MART.

BI Refresh: Apache Superset reflects the updated Revenue Forecast and Occupancy KPIs on the Owner's dashboard.
