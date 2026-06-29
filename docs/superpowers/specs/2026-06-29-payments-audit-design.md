# Payments Audit — Design Spec

**Date:** 2026-06-29
**Status:** Approved (design); pending implementation plan
**Sub-project 1 of 3** (Payments → Multi-company → Reports). This spec covers Payments only.

## Context

NextStay's canonical tenancy is `hotel_id` (atai line, now `main`). A divergent `dev`
branch built a payments/multi-company stack on `company_code`, which is incompatible and
was not merged. This spec re-implements the **payments audit** feature on `hotel_id`.

Current state on `main`:
- Stripe flow exists (`backend/app/api/v1/stripe.py`): `create-checkout-session`,
  `confirm-and-get-booking`, `webhook`. The webhook handles only
  `checkout.session.completed` and updates the **booking** row
  (`status=Confirmed`, `stripe_payment_intent_id`, `amount_paid`).
- There is **no** persistent payments/event record, so webhooks are **not idempotent**
  (a redelivered event reprocesses the booking) and there is **no audit trail**.
- A booking links to a hotel via `booking.room_id → rooms.hotel_id` (no direct
  `booking.hotel_id`). `rooms.hotel_id` is nullable FK to `hotels.id`.

## Goal

A `payments` table that (a) makes Stripe webhook processing **idempotent** and
(b) provides a full **audit log** of Stripe events. Scoped by `hotel_id`.

Out of scope (separate sub-projects / later): read API (`GET /payments`), admin UI,
multi-company scoping, reports.

## 1. Data model

New table `payments` (schema `public`), ORM model `Payment` in
`backend/app/models/payment.py`, created by bootstrap migration
`backend/migrations/add_payments_table.sql` (pinned into `MIGRATION_ORDER`).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `stripe_event_id` | VARCHAR(255) **UNIQUE NOT NULL** | idempotency key (Stripe `event.id`) |
| `event_type` | VARCHAR(100) | e.g. `checkout.session.completed` |
| `booking_id` | INTEGER FK→`bookings.id` ON DELETE SET NULL, nullable | not all events carry a booking |
| `hotel_id` | INTEGER FK→`hotels.id` ON DELETE SET NULL, nullable | derived from `booking.room.hotel_id` at insert |
| `stripe_session_id` | VARCHAR(255) nullable, indexed | |
| `stripe_payment_intent_id` | VARCHAR(255) nullable, indexed | |
| `payment_status` | VARCHAR(50) nullable | from event object |
| `currency` | VARCHAR(10) nullable | |
| `amount_total_cents` | INTEGER nullable | |
| `customer_email` | VARCHAR(255) nullable, indexed | |
| `payload` | JSONB | full event (audit) |
| `error_message` | TEXT nullable | set if the business handler raised |
| `created_at` | TIMESTAMPTZ NOT NULL default now() | |
| `updated_at` | TIMESTAMPTZ NOT NULL default now() on update | |

Difference from `dev`: `company_code` FK replaced by `hotel_id` FK; no `oltp` schema
(atai uses `public`).

## 2. Webhook flow

Modify `stripe_webhook` in `backend/app/api/v1/stripe.py`:

1. Verify Stripe signature (unchanged).
2. **Audit upsert by `stripe_event_id`:** insert a `Payment` row built from the event
   (`event_type`, full `payload`, `booking_id` from `session.metadata.booking_id` when
   present, `hotel_id` derived from `booking.room.hotel_id`, plus `stripe_session_id` /
   `stripe_payment_intent_id` / `payment_status` / `currency` / `amount_total_cents` /
   `customer_email`). Use `INSERT ... ON CONFLICT (stripe_event_id) DO UPDATE` so a
   redelivered event never creates a **duplicate audit row**. **All** incoming events
   are recorded, even unhandled types.
3. Dispatch business logic only for `checkout.session.completed` (existing booking
   update). The booking update is itself **idempotent**: it is guarded by
   `if booking.status != "Confirmed"`, so a redelivered event is a no-op on the booking.
4. On handler exception: set `error_message` on the payment row, keep the audit row,
   return `500` so Stripe retries. Because the booking update is idempotent (step 3),
   a retry safely re-runs without double effects.

### Two independent idempotency mechanisms (no state machine)

- **Audit dedup:** `stripe_event_id UNIQUE` + `ON CONFLICT DO UPDATE` → exactly one
  audit row per event id.
- **Business idempotency:** the booking update is naturally idempotent via the
  `status != "Confirmed"` guard. Business logic always runs (it is not gated on the
  audit row), so transient-failure retries still work; the guard makes re-runs no-ops.

This deliberately avoids a processed/unprocessed state machine on the payment row.

## 3. Error handling

- Unknown/unhandled event type: audit row written (step 2), no business logic, return `200`.
- Booking not found for a `checkout.session.completed`: audit row written with
  `error_message`, return `200` (nothing to retry — booking is gone).
- Business handler exception (transient): `error_message` set, return `500` so Stripe
  retries; the idempotent booking update (step 3 guard) makes the retry safe.

## 4. Testing (TDD)

`backend/tests/test_payments.py`:
1. First `checkout.session.completed` webhook → creates one `payments` row **and** sets
   booking `status=Confirmed`.
2. Duplicate event (same `event.id`) → no second row; booking update is a no-op.
3. `hotel_id` on the row equals the booking's `room.hotel_id`.
4. Unknown event type → audit row created, booking untouched, `200`.
5. `checkout.session.completed` with missing booking → audit row with `error_message`, `200`.

## Files

- `backend/app/models/payment.py` (new)
- `backend/migrations/add_payments_table.sql` (new) + `MIGRATION_ORDER` entry in `bootstrap.py`
- `backend/app/api/v1/stripe.py` (webhook changes)
- `backend/tests/test_payments.py` (new)

No Stripe SDK/version changes. No frontend changes.
