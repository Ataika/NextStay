# NextStay — Feature & Operations Overview

This document describes what the NextStay app can do (API + UI).

---

## Rooms

- **GET** `/api/v1/rooms` — list rooms
- **GET** `/api/v1/rooms/{room_id}` — get room by id
- **GET** `/api/v1/rooms/available` — availability search by dates  
  Params: `checkIn`, `checkOut`, optional `category`, optional `capacity`
- **POST** `/api/v1/rooms` — create room
- **PATCH** `/api/v1/rooms/{room_id}` — update room
- **DELETE** `/api/v1/rooms/{room_id}` — delete room

Room statuses: `Available`, `Occupied`, `Cleaning`, `Maintenance`, `Dirty`

---

## Bookings

- **GET** `/api/v1/bookings` — list bookings
- **GET** `/api/v1/bookings/{booking_id}` — get booking by id (includes `guestToken`)
- **POST** `/api/v1/bookings` — create booking (default status: `Pending`)
- **PATCH** `/api/v1/bookings/{booking_id}` — update booking
- **DELETE** `/api/v1/bookings/{booking_id}` — delete booking (also deletes related guest tokens)

Booking statuses: `Pending`, `Confirmed`, `Upcoming`, `Checked-in`, `Checked-out`, `Cancelled`, `Expired`

---

## Cleaning tasks

- **GET** `/api/v1/tasks` — list tasks (optional `room_id`)
- **GET** `/api/v1/tasks/{task_id}` — get task by id
- **POST** `/api/v1/tasks` — create task (sets room status to `Cleaning`)
- **PATCH** `/api/v1/tasks/{task_id}/assign` — assign task (sets status `In Progress`)
- **PATCH** `/api/v1/tasks/{task_id}/complete` — complete task (sets room status to `Available`)
- **DELETE** `/api/v1/tasks/{task_id}` — delete task

Task statuses: `Pending`, `In Progress`, `Completed`

---

## Guest portal (token-based)

- **GET** `/api/v1/guest/{token}` — guest details (Wi‑Fi, contacts, instructions, rules)
- **POST** `/api/v1/guest/{token}/checkout` — guest checkout  
  Effects:
  - booking → `Checked-out`
  - room → `Dirty`
  - creates a cleaning task

UI: `/guest/{token}`. After checkout, the UI shows a **farewell screen** (“Прощание”).

---

## Payments (Stripe)

- **POST** `/api/v1/stripe/create-checkout-session` — create checkout session for a booking (`booking_id`)
- **POST** `/api/v1/stripe/webhook` — Stripe webhooks (`checkout.session.completed` etc.)
- **GET** `/api/v1/stripe/confirm-and-get-booking?session_id=...` — success-page fallback confirmation + returns booking with `guestToken`

---

## Authentication (stub)

- **POST** `/api/v1/auth/login`
- **POST** `/api/v1/auth/logout`

---

## Frontend routes

Public:
- `/book`
- `/booking/success`
- `/booking/cancel`
- `/guest/:token`

Admin/staff:
- `/admin`
- `/bookings` (admin bookings table: filters + delete)
- `/staff` (tasks list: start/complete/delete)

---

## Notes

- Dates are ISO: `YYYY-MM-DDTHH:MM:SSZ`
- Status values are case-sensitive (e.g. `Available`)
