# API Endpoints (Stubs)

Все эндпоинты созданы как заглушки (stubs) для предотвращения ошибок 404 на фронтенде. Они возвращают базовые ответы или пустые массивы.

## Реализованные эндпоинты

### Health
- `GET /api/v1/health` - проверка работоспособности ✅

### Rooms
- `GET /api/v1/rooms` - возвращает пустой массив `[]`
- `GET /api/v1/rooms/{id}` - возвращает 404
- `POST /api/v1/rooms` - возвращает 501 (Not implemented)
- `PATCH /api/v1/rooms/{id}` - возвращает 404
- `DELETE /api/v1/rooms/{id}` - возвращает 404

### Tasks
- `GET /api/v1/tasks` - возвращает пустой массив `[]`
- `GET /api/v1/tasks?room_id={roomId}` - возвращает пустой массив `[]`
- `GET /api/v1/tasks/{id}` - возвращает 404
- `POST /api/v1/tasks` - возвращает 501 (Not implemented)
- `PATCH /api/v1/tasks/{taskId}/assign` - возвращает 404
- `PATCH /api/v1/tasks/{taskId}/complete` - возвращает 404

### Bookings
- `GET /api/v1/bookings` - возвращает пустой массив `[]`
- `GET /api/v1/bookings/{id}` - возвращает 404
- `POST /api/v1/bookings` - возвращает 501 (Not implemented)
- `PATCH /api/v1/bookings/{id}` - возвращает 404
- `DELETE /api/v1/bookings/{id}` - возвращает 404

### Auth
- `POST /api/v1/auth/login` - временная заглушка с тестовыми учетными данными:
  - `admin@nextstay.com` / `admin` → OWNER
  - `staff@nextstay.com` / `staff` → STAFF
- `POST /api/v1/auth/logout` - возвращает успешный ответ

### Guest
- `GET /api/v1/guest/{token}` - возвращает 404
- `POST /api/v1/guest/{token}/checkout` - возвращает 404

## Следующие шаги

Все эндпоинты помечены комментариями `# TODO: Реализовать...` и должны быть заменены на реальную логику работы с базой данных.

## Тестирование

После запуска бэкенда, все эндпоинты доступны и возвращают корректные HTTP ответы, что позволяет фронтенду работать без ошибок 404.
