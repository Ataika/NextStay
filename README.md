# NexStay OS 🏨

**NexStay OS** is a professional Enterprise Resource Planning (ERP) and Property Management System (PMS) designed to automate hotel operations, optimize service workflows, and provide advanced business intelligence.

---

##  Project Architecture
The system follows a **Service-Oriented Architecture (SOA)** approach, fully containerized for scalable deployment.

* **Frontend:** React.js + TypeScript + Tailwind CSS (Vite-based SPA).
* **Backend:** FastAPI (Python) + SQLAlchemy (High-performance asynchronous API).
* **Database:** PostgreSQL 15 (Relational Storage & Data Warehouse).
* **Analytics:** dbt Core (ELT transformations) + Apache Superset (BI Visualization).
* **Orchestration:** Docker & Docker Compose.

---

##  Academic Requirements (Software Engineering)
*This project is categorized according to the three functional pillars required by the course:*

###  Category A: Data-Oriented Functionalities (CRUD)
* **Inventory Management:** Full lifecycle of rooms and occupancy states.
* **Booking System:** Guest registration, stay tracking, and reservation history.
* **Staff Roles:** Management of employee profiles and access levels.

###  Category B: Third-Party Services & Integrations
* **BI Visualization:** Apache Superset integration for real-time dashboards.
* **Notification Engine:** Telegram Bot API for instant housekeeping alerts.
* **Financial Services:** Automated PDF Invoice generation (ReportLab) and SMTP email confirmations.

###  Category C: Complex Functionalities (Algorithms)
* **Dynamic Pricing Engine:** Real-time price adjustment algorithm based on supply/demand and lead time.
* **Weighted Task Dispatcher:** Intelligent housekeeping prioritization algorithm.
* **Analytical DWH Pipeline:** Multi-layer ELT (STG -> CORE -> MART) with SCD Type 2 logic and Loyalty Tiering algorithms.

---

##  The Team
* **Dair:** Core Software Engineer (Backend API, Category C Algorithms).
* **Atay:** Data & Infrastructure Architect (DWH Design, dbt Pipelines, BI).
* **Turat:** UX & Integration Engineer (Frontend, 3rd Party API, PDF/SMTP).

---

##  Quick Start
```bash
# Start the entire infrastructure (DB, Backend, BI, dbt)
docker-compose up -d --build
