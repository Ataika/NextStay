NexStay OS 
Enterprise Resource Planning (ERP) & Property Management System (PMS)

NexStay OS is a professional-grade Property Management System designed to minimize human intervention in hospitality operations through automated access control, intelligent task orchestration, and advanced business intelligence.

 Project Architecture
The system utilizes a Service-Oriented Architecture (SOA), fully containerized to ensure scalable deployment and environmental consistency.

Frontend: React.js, TypeScript, and Tailwind CSS (Vite-based SPA).

Backend: FastAPI (Python) with SQLAlchemy for high-performance asynchronous API operations.

Database: PostgreSQL 15, serving as both the OLTP (Transactional) and OLAP (Analytical) engine.

Analytics Layer: dbt Core (ELT transformations) and Apache Superset (BI Visualization).

Orchestration: Docker Compose and Apache Airflow for automated data pipelines.

 Business Value & Core Functionalities
The system is engineered to maximize Revenue Per Available Room (RevPAR) and optimize operational overhead. It is categorized into three functional pillars:

Category A: Data-Oriented Functionalities (CRUD)

Inventory Management: Comprehensive lifecycle management of room inventory and real-time occupancy states.

Booking System: Robust guest registration, stay tracking, and historical reservation management.

Staff Roles: Role-Based Access Control (RBAC) for managing employee profiles and organizational hierarchies.

Category B: Third-Party Integrations

BI Visualization: Native integration with Apache Superset for real-time executive dashboards.

Notification Engine: Telegram Bot API integration for instantaneous housekeeping alerts and status updates.

Financial Services: Automated PDF invoice generation via ReportLab and SMTP-based email confirmations.

Category C: Complex Algorithmic Logic

Dynamic Pricing Engine: A real-time price adjustment algorithm that optimizes rates based on supply/demand and booking lead time.

Weighted Task Dispatcher: An intelligent housekeeping prioritization algorithm designed to optimize turnaround time.

Analytical DWH Pipeline: A multi-layer ELT process (STG -> CORE -> MART) utilizing SCD Type 2 logic and automated Loyalty Tiering.

 Data Warehouse Design
To support Category C requirements, the Data Layer is organized into three analytical stages:

Staging (STG): Raw data ingestion from backend sources with audit metadata.

Core (DDS): A normalized model using Surrogate Keys and Slowly Changing Dimensions (SCD Type 2) for historical price tracking.

Mart: High-performance analytical views for calculating KPIs such as Occupancy Rates, Revenue Forecasts, and Staff Performance.

Project Team
Dair: Core Software Engineer (Backend API & Category C Algorithms).

Atay: Data & Infrastructure Architect (DWH Design, Airflow/dbt Pipelines, & BI Infrastructure).

Turat: UX & Integration Engineer (Frontend SPA, 3rd Party APIs, & Financial Services).

 Deployment
Bash
# 1. Clone the repository and configure the .env file

# 2. Deploy the full infrastructure
docker-compose up -d --build

# 3. Execute the Master Setup Script
chmod +x scripts/setup_all.sh
./scripts/setup_all.sh
