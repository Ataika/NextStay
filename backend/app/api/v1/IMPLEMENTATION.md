# Реализация CRUD операций

## Что было реализовано

### 1. Модели базы данных (SQLAlchemy)

Созданы модели в `app/models/`:
- **Room** (`room.py`) - комнаты отеля
- **CleaningTask** (`task.py`) - задачи уборки
- **Booking** (`booking.py`) - бронирования

### 2. CRUD операции

#### Rooms API (`/api/v1/rooms`)
- ✅ `GET /rooms` - получить все комнаты
- ✅ `GET /rooms/{id}` - получить комнату по ID
- ✅ `POST /rooms` - создать комнату
- ✅ `PATCH /rooms/{id}` - обновить комнату
- ✅ `DELETE /rooms/{id}` - удалить комнату

#### Tasks API (`/api/v1/tasks`)
- ✅ `GET /tasks` - получить все задачи
- ✅ `GET /tasks?room_id={roomId}` - получить задачи по комнате
- ✅ `GET /tasks/{id}` - получить задачу по ID
- ✅ `POST /tasks` - создать задачу
- ✅ `PATCH /tasks/{taskId}/assign` - назначить задачу сотруднику
- ✅ `PATCH /tasks/{taskId}/complete` - завершить задачу

#### Bookings API (`/api/v1/bookings`)
- ✅ `GET /bookings` - получить все бронирования
- ✅ `GET /bookings/{id}` - получить бронирование по ID
- ✅ `POST /bookings` - создать бронирование
- ✅ `PATCH /bookings/{id}` - обновить бронирование
- ✅ `DELETE /bookings/{id}` - удалить бронирование

### 3. Автоматическое создание таблиц

Таблицы создаются автоматически при старте приложения через `Base.metadata.create_all(bind=engine)` в `main.py`.

## Структура таблиц

### rooms
- `id` (SERIAL PRIMARY KEY)
- `number` (VARCHAR(10), UNIQUE)
- `category` (VARCHAR(50))
- `status` (VARCHAR(20))
- `price` (FLOAT)
- `capacity` (INTEGER)
- `description` (TEXT)
- `amenities` (JSON) - массив строк

### cleaning_tasks
- `id` (SERIAL PRIMARY KEY)
- `room_id` (INTEGER, FK -> rooms.id)
- `room_number` (VARCHAR(10))
- `status` (VARCHAR(20))
- `priority` (VARCHAR(20))
- `assigned_to` (INTEGER) - ID сотрудника
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

## Формат данных

### API использует camelCase:
- `roomId`, `roomNumber`, `checkIn`, `checkOut`, `createdAt`, `assignedTo`, `assignedToName`, `completedAt`

### База данных использует snake_case:
- `room_id`, `room_number`, `check_in`, `check_out`, `created_at`, `assigned_to`, `assigned_to_name`, `completed_at`

Преобразование выполняется автоматически через Pydantic модели с `from_attributes = True`.

## Примеры использования

### Создать комнату
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

### Создать задачу
```json
POST /api/v1/tasks
{
  "roomId": 1,
  "roomNumber": "101",
  "priority": "High",
  "notes": "Urgent cleaning"
}
```

### Создать бронирование
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

## Важные замечания

1. **Даты**: Используйте ISO формат (например, `2026-01-20T14:00:00Z`)
2. **Уникальность**: Номер комнаты должен быть уникальным
3. **Внешние ключи**: При создании задач и бронирований убедитесь, что `room_id` существует
4. **Статусы**: 
   - Rooms: `Available`, `Occupied`, `Dirty`, `Maintenance`
   - Tasks: `Pending`, `In Progress`, `Completed`
   - Bookings: `Upcoming`, `Checked-in`, `Checked-out`
