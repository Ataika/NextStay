# NextStay Workflows

This document describes the main business workflows and how they map to API calls and database changes.

## Database

PostgreSQL 15 (host port **5433**)

Tables:
- `rooms`
- `bookings`
- `guest_tokens`
- `cleaning_tasks`

---

## 1) Room management (Admin)

### Create room
- Frontend: `AdminPage.tsx`
- API: `POST /api/v1/rooms`
- DB: `rooms` (INSERT)

### Update room
- API: `PATCH /api/v1/rooms/{id}`
- DB: `rooms` (UPDATE)

### Delete room
- API: `DELETE /api/v1/rooms/{id}`
- DB: `rooms` (DELETE)

---

## 2) Booking flow (Guest)

### Search availability
- API: `GET /api/v1/rooms/available`

### Create booking (Pending)
- API: `POST /api/v1/bookings`
- DB:
  - `bookings` (INSERT, status = `Pending`)
  - `guest_tokens` (INSERT)

### Pay with Stripe → Confirmed
- API: `POST /api/v1/stripe/create-checkout-session`
- Stripe redirects to `/booking/success?session_id=...`
- Confirmation happens via:
  - Stripe webhook `POST /api/v1/stripe/webhook`, or
  - Success page fallback `GET /api/v1/stripe/confirm-and-get-booking?session_id=...`

### Guest checkout
- API: `POST /api/v1/guest/{token}/checkout`
- DB:
  - `guest_tokens` (UPDATE: invalid)
  - `bookings` (UPDATE: `Checked-out`)
  - `rooms` (UPDATE: `Dirty`)
  - `cleaning_tasks` (INSERT: high priority)
- UI: guest sees a farewell screen after checkout

---

## 3) Cleaning tasks (Staff)

### Assign task
- API: `PATCH /api/v1/tasks/{id}/assign`
- DB: `cleaning_tasks` (UPDATE → `In Progress`)

### Complete task
- API: `PATCH /api/v1/tasks/{id}/complete`
- DB:
  - `cleaning_tasks` (UPDATE → `Completed`)
  - `rooms` (UPDATE → `Available`)

### Delete task
- API: `DELETE /api/v1/tasks/{id}`

---

## 4) Admin cleanup

### Delete booking (cleanup Pending spam)
- API: `DELETE /api/v1/bookings/{id}`
- DB:
  - deletes related rows in `guest_tokens`
  - deletes booking row
