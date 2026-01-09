# Software Requirements Specification (SRS) - NexStay 

## 1. Introduction
### 1.1 Purpose
NexStay OS is an automated Property Management System (PMS) designed to minimize human intervention in hotel operations through automated access control and smart housekeeping management.

### 1.2 Scope
The system provides a unified platform for:
* Backend administration and data management.
* Role-based Frontend dashboards for owners and staff.
* Integrated Business Intelligence (BI) for real-time analytics via Apache Superset.

## 2. User Roles & Characteristics
* **Administrator (Owner):** Manages room inventory, pricing, and monitors financial performance.
* **Staff (Housekeeper):** Receives automated cleaning tasks and updates room readiness.
* **Guest:** Accesses the digital room key and performs rapid self-checkout.

## 3. Functional Requirements
* **FR1 (Inventory Management):** The system shall allow administrators to perform CRUD operations on hotel rooms and categories.
* **FR2 (Automated Status Transition):** Upon guest check-out, the system **must** automatically switch the room status to "Dirty".
* **FR3 (Housekeeping Dispatch):** The system shall automatically generate a record in the `CleaningTasks` table when a room status becomes "Dirty".
* **FR4 (Real-time Analytics):** The system shall integrate with Apache Superset to visualize occupancy rates, revenue, and staff performance.

## 4. Non-Functional Requirements
* **Security:** All passwords must be hashed using BCrypt. API communication must be secured via JWT (JSON Web Tokens).
* **Reliability:** The system shall be containerized using Docker to ensure consistent behavior across development and production environments.
* **Maintainability:** The frontend must use **TypeScript** to ensure type safety and long-term code quality.
