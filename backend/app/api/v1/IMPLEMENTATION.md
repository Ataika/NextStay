# CRUD Implementation Notes

This document describes what is implemented in the v1 API.

## 1) Database models (SQLAlchemy)

Models in `app/models/`:
- **Room** (`room.py`)
- **CleaningTask** (`task.py`)
- **Booking** (`booking.py`)
- **GuestToken** (`guest_token.py`)

## 2) API endpoints

### Rooms (`/api/v1/rooms`)
- ✅ `GET /rooms`
- ✅ `GET /rooms/{id}`
- ✅ `POST /rooms`
- ✅ `PATCH /rooms/{id}`
- ✅ `DELETE /rooms/{id}`
- ✅ `GET /rooms/available`

### Tasks (`/api/v1/tasks`)
- ✅ `GET /tasks`
- ✅ `GET /tasks?room_id={roomId}`
- ✅ `GET /tasks/{id}`
- ✅ `POST /tasks`
- ✅ `PATCH /tasks/{id}/assign`
- ✅ `PATCH /tasks/{id}/complete`
- ✅ `DELETE /tasks/{id}`

### Bookings (`/api/v1/bookings`)
- ✅ `GET /bookings`
- ✅ `GET /bookings/{id}`
- ✅ `POST /bookings`
- ✅ `PATCH /bookings/{id}`
- ✅ `DELETE /bookings/{id}` (also removes related guest tokens)

### Stripe (`/api/v1/stripe/*`)
- ✅ Create checkout sessions
- ✅ Webhook handler
- ✅ Success-page confirmation endpoint

## 3) Table creation

Note: automatic table creation via `Base.metadata.create_all(...)` in `main.py` may be disabled in some dev setups. Prefer migrations for schema changes (see `backend/migrations/`).

## DB schema (high-level)

### rooms
- `id` (SERIAL PRIMARY KEY)
- `number` (VARCHAR(10), UNIQUE)
- `category` (VARCHAR(50))
- `status` (VARCHAR(20))
- `price` (FLOAT)
- `capacity` (INTEGER)
- `description` (TEXT)
- `amenities` (JSON) - array of strings

### cleaning_tasks
- `id` (SERIAL PRIMARY KEY)
- `room_id` (INTEGER, FK -> rooms.id)
- `room_number` (VARCHAR(10))
- `status` (VARCHAR(20))
- `priority` (VARCHAR(20))
- `assigned_to` (INTEGER) - staff id
- `assigned_to_name` (VARCHAR(100))
- `created_at` (TIMESTAMP)
- `completed_at` (TIMESTAMP, nullable)
- `notes` (VARCHAR(500))

### bookings
- `id` (SERIAL PRIMARY KEY)
- `guest_name` (VARCHAR(100))
- `room_id` (INTEGER, FK -> rooms.id)
- `room_number` (VARCHAR(10))
- `check_in` (TIMESTAMP)
- `check_out` (TIMESTAMP)
- `status` (VARCHAR(20))
- `created_at` (TIMESTAMP)
- `notes` (VARCHAR(500))

## Data format

### API uses camelCase:
- `roomId`, `roomNumber`, `checkIn`, `checkOut`, `createdAt`, `assignedTo`, `assignedToName`, `completedAt`

### Database uses snake_case:
- `room_id`, `room_number`, `check_in`, `check_out`, `created_at`, `assigned_to`, `assigned_to_name`, `completed_at`

Conversion is done in the Pydantic response models.

## Examples

### Create a room
```json
POST /api/v1/rooms
{
  "number": "101",
  "category": "Standard",
  "status": "Available",
  "price": 25.0,
  "capacity": 2,
  "description": "Comfortable room",
  "amenities": ["Wi-Fi", "TV"]
}
```

### Create a task
```json
POST /api/v1/tasks
{
  "roomId": 1,
  "roomNumber": "101",
  "priority": "High",
  "notes": "Urgent cleaning"
}
```

### Create a booking
```json
POST /api/v1/bookings
{
  "guestName": "John Doe",
  "roomId": 1,
  "roomNumber": "101",
  "checkIn": "2026-01-20T14:00:00Z",
  "checkOut": "2026-01-22T12:00:00Z",
  "status": "Upcoming"
}
```

## Notes

1. Dates: ISO (e.g. `2026-01-20T14:00:00Z`)
2. Room numbers must be unique
3. Make sure referenced room IDs exist
4. Status values are case-sensitive
