# Guest Token & Booking

This document describes the guest-token subsystem used for self-service access.

## What is implemented

### GuestToken model

`GuestToken` is stored in `app/models/guest_token.py` and contains:
- a unique token per booking
- links to booking and room
- Wi‑Fi, contacts, instructions, house rules
- validity and access status

### Automatic token creation

When a booking is created (`POST /api/v1/bookings`), the backend:
1. Creates a booking (default status: `Pending`)
2. Generates a unique guest token
3. Creates a `guest_tokens` record with all required guest info
4. Returns `guestToken` in the booking response (when requested)

## Guest API

### `GET /api/v1/guest/{token}`

Returns guest access details:
- validates token
- checks expiry (based on `check_out`)
- returns Wi‑Fi, contacts, instructions, rules

### `POST /api/v1/guest/{token}/checkout`

Performs guest checkout:
1. token → invalid (`Checked out`)
2. booking → `Checked-out`
3. room → `Dirty`
4. creates a high-priority cleaning task

## Data shape (high-level)

Guest token fields:
- `token` (e.g. `guest-token-abc123xyz`)
- `booking_id`, `room_id`, `room_number`, `guest_name`
- `check_in`, `check_out`
- `is_valid`, `access_status` (`Active`, `Expired`, `Checked out`)
- `wifi_ssid`, `wifi_password`
- `contact_info`, `instructions`, `house_rules` (JSON)

## Frontend integration

Frontend can:
1. Create a booking and receive `guestToken`
2. Share the guest link `/guest/{token}` (email/SMS optional)
3. Guest uses the page to view info and run checkout

Note: after checkout, the UI shows a farewell screen (no need to re-open the token).
