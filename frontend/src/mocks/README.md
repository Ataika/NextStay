# Mock Data для разработки

Этот модуль содержит моки данных для работы без backend.

## Использование

### Переключение между моками и реальным API

По умолчанию используется mock API. Чтобы переключиться на реальный API:

1. Создайте файл `.env` в корне `frontend/`
2. Добавьте:
   ```
   VITE_USE_MOCK_API=false
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

### Mock данные

- **Rooms** (`mocks/rooms.ts`) - 8 номеров с разными статусами
- **Tasks** (`mocks/tasks.ts`) - 5 задач уборки
- **Guest Tokens** (`mocks/guest.ts`) - 3 токена для гостей

### Mock логин

Для тестирования аутентификации используйте:

**Admin:**
- Email: `admin@nextstay.com`
- Password: `admin`
- Роль: `OWNER`

**Staff:**
- Email: `staff@nextstay.com`
- Password: `staff`
- Роль: `STAFF`

### Guest токены

- `guest-token-abc123` - валидный токен для комнаты 102
- `guest-token-xyz789` - валидный токен для комнаты 203
- `guest-token-expired` - истекший токен

### Использование API

```typescript
import { roomsApi, tasksApi, guestApi, authApi } from "../api/api";

// Получить все комнаты
const rooms = await roomsApi.getAll();

// Получить все задачи
const tasks = await tasksApi.getAll();

// Получить данные гостя по токену
const guest = await guestApi.getByToken("guest-token-abc123");
```
