# System Architecture - NexStay

## 1. Technical Stack
* **Frontend:** React.js + TypeScript + Tailwind CSS (Vite-based).
* **Backend:** Python + FastAPI + SQLAlchemy (ORM).
* **Database:** PostgreSQL (Relational Database).
* **BI Platform:** Apache Superset (Data Visualization).
* **Infrastructure:** Docker & Docker Compose (Containerization).

## 2. System Components
NexStay OS follows a **Service-Oriented Architecture (SOA)** approach:

1. **Presentation Layer (Frontend):** A responsive Single Page Application (SPA) built with React and TypeScript. It communicates with the Backend via RESTful APIs.
2. **Logic Layer (Backend):** A high-performance FastAPI server that handles business logic, authentication, and database orchestration.
3. **Data Layer (PostgreSQL):** A centralized relational database that stores users, rooms, bookings, and logs.
4. **Analytics Layer (Superset):** An independent BI service that connects to the PostgreSQL "Read-Only" replica to provide real-time dashboards for hotel owners.

## 3. Deployment Architecture (Docker Compose)
The system is orchestrated via `docker-compose.yml` with the following services:
* **`db-service`**: PostgreSQL 15, exposing port `5432`.
* **`backend-api`**: FastAPI application, exposing port `8000`.
* **`frontend-app`**: React TS application, exposing port `5173`.
* **`superset-bi`**: Apache Superset, exposing port `8088`.

## 4. Data Flow Logic
1. **User Action:** A Guest triggers a "Check-out" event on the Frontend.
2. **API Request:** The Frontend sends a PATCH request to the Backend.
3. **State Change:** The Backend updates the `Rooms` table and inserts a new `CleaningTask` record.
4. **BI Refresh:** Apache Superset queries the updated database to reflect the new occupancy and task status on the Owner's dashboard.
