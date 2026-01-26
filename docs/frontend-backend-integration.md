# Интеграция фронтенда и бэкенда

## Текущее состояние

### Фронтенд
- **Технологии**: React + TypeScript + Vite
- **HTTP клиент**: Axios
- **Базовый URL API**: `http://localhost:8000/api/v1` (по умолчанию)
- **Режим работы**: По умолчанию использует Mock API для разработки

### Бэкенд
- **Технологии**: FastAPI + Python
- **Порт**: 8000
- **Префикс API**: `/api/v1`
- **CORS**: Настроен для работы с фронтендом

## Настройка подключения

### 1. Создайте файл `.env` в папке `frontend/`

Скопируйте `.env.example` в `.env`:

```bash
cd frontend
cp .env.example .env
```

Или создайте файл `.env` со следующим содержимым:

```env
# Отключить Mock API и использовать реальный бэкенд
VITE_USE_MOCK_API=false

# URL бэкенда (с префиксом /api/v1)
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### 2. Запустите бэкенд

#### Вариант A: Через Docker Compose (рекомендуется)

```bash
# Из корня проекта
docker-compose up backend db
```

Бэкенд будет доступен на `http://localhost:8000`

#### Вариант B: Локально

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Запустите фронтенд

```bash
cd frontend
npm install
npm run dev
```

Фронтенд будет доступен на `http://localhost:5173` (или другой порт, если 5173 занят)

## Структура API

### Текущие endpoints (требуют реализации в бэкенде)

Фронтенд ожидает следующие endpoints:

#### Rooms API
- `GET /api/v1/rooms` - получить все комнаты
- `GET /api/v1/rooms/{id}` - получить комнату по ID
- `POST /api/v1/rooms` - создать комнату
- `PATCH /api/v1/rooms/{id}` - обновить комнату
- `DELETE /api/v1/rooms/{id}` - удалить комнату

#### Tasks API
- `GET /api/v1/tasks` - получить все задачи
- `GET /api/v1/tasks/{id}` - получить задачу по ID
- `GET /api/v1/tasks?room_id={roomId}` - получить задачи по комнате
- `POST /api/v1/tasks` - создать задачу
- `PATCH /api/v1/tasks/{taskId}/assign` - назначить задачу сотруднику
- `PATCH /api/v1/tasks/{taskId}/complete` - завершить задачу

#### Bookings API
- `GET /api/v1/bookings` - получить все бронирования
- `GET /api/v1/bookings/{id}` - получить бронирование по ID
- `POST /api/v1/bookings` - создать бронирование
- `PATCH /api/v1/bookings/{id}` - обновить бронирование
- `DELETE /api/v1/bookings/{id}` - удалить бронирование

#### Auth API
- `POST /api/v1/auth/login` - авторизация
  - Body: `{ "email": string, "password": string }`
  - Response: `{ "token": string, "role": string, "user": {...} }`
- `POST /api/v1/auth/logout` - выход

#### Guest API
- `GET /api/v1/guest/{token}` - получить данные гостя по токену
- `POST /api/v1/guest/{token}/checkout` - выезд гостя

### Реализованные endpoints

- `GET /api/v1/health` - проверка работоспособности бэкенда

## Переключение между Mock и Real API

### Использование Mock API (по умолчанию)

Mock API включен по умолчанию для удобства разработки фронтенда без бэкенда.

В файле `frontend/src/api/mockApi.ts`:
```typescript
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true" || 
                            import.meta.env.VITE_USE_MOCK_API !== "false";
```

### Использование Real API

1. Создайте `.env` файл в `frontend/`
2. Установите `VITE_USE_MOCK_API=false`
3. Убедитесь, что бэкенд запущен
4. Перезапустите dev server фронтенда

## CORS настройки

CORS уже настроен в `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Если фронтенд работает на другом порту, добавьте его в `allow_origins`.

## Аутентификация

Фронтенд отправляет токен в заголовке `Authorization: Bearer {token}`.

Бэкенд должен:
1. Проверять токен в заголовке `Authorization`
2. Возвращать 401 при невалидном/отсутствующем токене
3. Фронтенд автоматически перенаправит на `/login` при 401

## Следующие шаги

1. ✅ Добавлен CORS middleware в бэкенд
2. ✅ Исправлено несоответствие URL префиксов
3. ✅ Создан `.env.example` для фронтенда
4. ⏳ Реализовать API endpoints в бэкенде:
   - Rooms API
   - Tasks API
   - Bookings API
   - Auth API
   - Guest API
5. ⏳ Настроить аутентификацию в бэкенде
6. ⏳ Создать модели базы данных
7. ⏳ Настроить миграции базы данных

## Проверка подключения

1. Убедитесь, что бэкенд запущен: `curl http://localhost:8000/api/v1/health`
2. Проверьте CORS: откройте DevTools в браузере и посмотрите на запросы
3. Проверьте переменные окружения: в консоли браузера `console.log(import.meta.env)`

## Troubleshooting

### Ошибка CORS
- Проверьте, что CORS middleware добавлен в `backend/app/main.py`
- Убедитесь, что порт фронтенда добавлен в `allow_origins`

### 404 Not Found
- Проверьте, что URL в `.env` правильный: должен быть `/api/v1`, а не `/api`
- Убедитесь, что бэкенд запущен и доступен

### Connection refused
- Проверьте, что бэкенд запущен на порту 8000
- Проверьте firewall настройки

### Mock API все еще используется
- Убедитесь, что `.env` файл создан в папке `frontend/`
- Проверьте, что `VITE_USE_MOCK_API=false`
- Перезапустите dev server (переменные окружения загружаются при старте)
