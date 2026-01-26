# Локальный запуск NextStay

## Требования

- Docker & Docker Compose
- Node.js 18+ и npm
- Python 3.11+ (опционально, для локального запуска бэкенда)

## Быстрый старт

### 1. Настройка переменных окружения

В корне проекта создайте файл `.env` (если его нет):

```env
DB_NAME=nextstay
DB_USER=nextstay
DB_PASSWORD=nextstay
SUPERSET_SECRET_KEY=dev
```

### 2. Запуск БД и Backend через Docker

```bash
# Запустить только БД и Backend
docker-compose up db backend

# Или в фоновом режиме
docker-compose up -d db backend
```

**Проверка:**
- Backend API: http://localhost:8000/api/v1/health
- API Docs: http://localhost:8000/docs
- БД доступна на порту `5433` (localhost:5433)

### 3. Запуск Frontend

```bash
cd frontend

# Установка зависимостей (первый раз)
npm install

# Запуск dev сервера
npm run dev
```

**Проверка:**
- Frontend: http://localhost:5173

### 4. Настройка Frontend (опционально)

В `frontend/.env` убедитесь, что:
```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Альтернативный запуск (без Docker)

### Backend локально

```bash
cd backend

# Установка зависимостей
pip install -r requirements.txt

# Настройка переменных окружения
export POSTGRES_USER=nextstay
export POSTGRES_PASSWORD=nextstay
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5433
export POSTGRES_DB=nextstay

# Запуск
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### БД локально

Убедитесь, что PostgreSQL запущен на порту `5433` (или измените порт в `.env` и `docker-compose.yml`).

## Остановка

```bash
# Остановить все контейнеры
docker-compose down

# Остановить и удалить volumes
docker-compose down -v
```

## Тестовые учетные данные

**Авторизация (заглушка):**
- Admin: `admin@nextstay.com` / `admin`
- Staff: `staff@nextstay.com` / `staff`

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f backend

# Пересборка контейнеров
docker-compose up --build db backend

# Проверка статуса БД
docker-compose ps
```
