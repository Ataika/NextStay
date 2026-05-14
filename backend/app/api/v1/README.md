# NextStay API (v1)

This folder contains the FastAPI v1 routes.

For a complete feature/endpoint overview, see the repo-level `PROJECT_FEATURES.md`.

## Health

- `GET /api/v1/health`

## Rooms

- `GET /api/v1/rooms`
- `GET /api/v1/rooms/{room_id}`
- `GET /api/v1/rooms/available`
- `POST /api/v1/rooms`
- `PATCH /api/v1/rooms/{room_id}`
- `DELETE /api/v1/rooms/{room_id}`

## Bookings

- `GET /api/v1/bookings`
- `GET /api/v1/bookings/{booking_id}`
- `POST /api/v1/bookings`
- `PATCH /api/v1/bookings/{booking_id}`
- `DELETE /api/v1/bookings/{booking_id}`

## Tasks

- `GET /api/v1/tasks` (optional `room_id`)
- `GET /api/v1/tasks/{task_id}`
- `POST /api/v1/tasks`
- `PATCH /api/v1/tasks/{task_id}/assign`
- `PATCH /api/v1/tasks/{task_id}/complete`
- `DELETE /api/v1/tasks/{task_id}`

## Guest

- `GET /api/v1/guest/{token}`
- `POST /api/v1/guest/{token}/checkout`

## Stripe

- `POST /api/v1/stripe/create-checkout-session`
- `POST /api/v1/stripe/webhook`
- `GET /api/v1/stripe/confirm-and-get-booking`

## Auth (stub)

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
