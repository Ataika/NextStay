# Hotel Sync Simulator

This module demonstrates how NextStay can receive reservation data from an external hotel website or channel manager and keep the internal room inventory synchronized.

## What was added

- `public.hotel_sync_events` stores every inbound external event with payload, processing state, error text, timestamps, and linked booking id.
- `public.hotel_channel_bookings` maps external booking ids to internal `bookings.id` records.
- `POST /api/v1/hotel-sync/events` receives external events with an `X-Hotel-Sync-Token` header.
- `GET /api/v1/hotel-sync/events` and `GET /api/v1/hotel-sync/channel-bookings` expose the synchronization audit log for managers.
- `/hotel-site-simulator` provides a primitive hotel website booking screen inside the admin app.
- `scripts/simulate_hotel_site_booking.py` sends the same event flow from the command line.

## Supported Events

| Event type | Effect |
| --- | --- |
| `booking_created` | Creates a NextStay booking, guest token, channel mapping, and blocks availability for selected dates. |
| `booking_cancelled` | Marks the mapped booking as `Cancelled`, invalidates guest token access, and releases the room if possible. |
| `room_status_updated` | Updates the room operational status from an external source. |

## Run Migration

```bash
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < scripts/migrate_add_hotel_sync.sql
```

For a new database, `scripts/init-db.sql` already contains these tables.

## Environment

```bash
HOTEL_SYNC_TOKEN_ENABLED=true
HOTEL_SYNC_TOKEN=dev-hotel-sync-token
VITE_HOTEL_SYNC_TOKEN=dev-hotel-sync-token
```

## CLI Demo

```bash
python scripts/simulate_hotel_site_booking.py --room-number 101
```

Cancel the same external booking:

```bash
python scripts/simulate_hotel_site_booking.py --cancel --external-booking-id CLI-1234567890
```

## Synchronization Flow

```mermaid
sequenceDiagram
    autonumber
    participant Guest as Guest on hotel site
    participant HotelSite as Hotel website simulator
    participant SyncAPI as NextStay /hotel-sync/events
    participant Events as hotel_sync_events
    participant Mapping as hotel_channel_bookings
    participant Booking as bookings
    participant Rooms as rooms
    participant Tokens as guest_tokens

    Guest->>HotelSite: Select dates and room
    HotelSite->>SyncAPI: POST booking_created event
    SyncAPI->>Events: Store raw event payload
    SyncAPI->>Booking: Check date conflicts
    SyncAPI->>Booking: Create internal booking
    SyncAPI->>Tokens: Create guest portal token
    SyncAPI->>Mapping: Link external id to booking id
    SyncAPI->>Rooms: Mark current stay as Occupied
    SyncAPI->>Events: Mark event as processed
    SyncAPI-->>HotelSite: Return booking id and sync status
```

## Database ERD

```mermaid
erDiagram
    ROOMS ||--o{ BOOKINGS : contains
    ROOMS ||--o{ HOTEL_CHANNEL_BOOKINGS : maps
    BOOKINGS ||--o{ GUEST_TOKENS : grants
    BOOKINGS ||--o{ HOTEL_CHANNEL_BOOKINGS : external_reference
    BOOKINGS ||--o{ HOTEL_SYNC_EVENTS : processing_result

    ROOMS {
        int id PK
        varchar number UK
        varchar category
        varchar status
        float price
        int capacity
    }

    BOOKINGS {
        int id PK
        int room_id FK
        varchar room_number
        varchar guest_name
        varchar guest_email
        timestamptz check_in
        timestamptz check_out
        varchar status
        float amount_paid
    }

    GUEST_TOKENS {
        int id PK
        int booking_id FK
        int room_id FK
        varchar token UK
        boolean is_valid
        varchar access_status
    }

    HOTEL_SYNC_EVENTS {
        int id PK
        int hotel_id
        text external_event_id UK
        text source
        text event_type
        jsonb payload
        text status
        int booking_id FK
    }

    HOTEL_CHANNEL_BOOKINGS {
        int id PK
        int hotel_id
        text external_booking_id
        int booking_id FK
        int room_id FK
        varchar room_number
        text status
    }
```

## Component Flow

```mermaid
flowchart LR
    HotelSite[External hotel website simulator] -->|booking_created / booking_cancelled| SyncAPI[Hotel Sync API]
    SyncAPI --> EventLog[(hotel_sync_events)]
    SyncAPI --> ChannelMap[(hotel_channel_bookings)]
    SyncAPI --> Booking[(bookings)]
    Booking --> GuestToken[(guest_tokens)]
    Booking --> Availability[Availability endpoint]
    Availability --> BookingPage[NextStay booking page]
    ChannelMap --> AdminAudit[Hotel Sync admin audit]
```
