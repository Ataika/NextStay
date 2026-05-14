# Mock data (frontend)

This module contains mock data so the UI can run without the backend.

## Usage

### Switch between Mock API and real API

By default, mock API may be enabled depending on `VITE_USE_MOCK_API`.

Create `frontend/.env`:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Restart the Vite dev server after changes.

### Mock datasets

- **Rooms** (`mocks/rooms.ts`)
- **Tasks** (`mocks/tasks.ts`)
- **Guest tokens** (`mocks/guest.ts`)

### Mock login (auth stub)

- Admin: `admin@nextstay.com` / `admin` (role `OWNER`)
- Staff: `staff@nextstay.com` / `staff` (role `STAFF`)

### Guest tokens (examples)

- `guest-token-abc123` — valid token (room 102)
- `guest-token-xyz789` — valid token (room 203)
- `guest-token-expired` — expired token

### API usage

```typescript
import { roomsApi, tasksApi, guestApi, authApi } from "../api/api";

// Получить все комнаты
const rooms = await roomsApi.getAll();

// Получить все задачи
const tasks = await tasksApi.getAll();

// Получить данные гостя по токену
const guest = await guestApi.getByToken("guest-token-abc123");
```
