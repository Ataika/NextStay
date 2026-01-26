# Структура проекта NextStay

Краткое описание файлов и папок проекта.

## 📁 Корневая директория

### Конфигурационные файлы
- **`.env`** - Переменные окружения для Docker Compose (БД, пароли, ключи)
- **`.gitignore`** - Игнорируемые Git файлы
- **`docker-compose.yml`** - Конфигурация Docker контейнеров (БД, Backend, Superset, dbt)
- **`README.md`** - Основная документация проекта
- **`LOCAL_SETUP.md`** - Инструкция по локальному запуску
- **`init.sql`** - SQL скрипт инициализации БД (legacy)

### Папки
- **`backend/`** - Backend приложение (FastAPI)
- **`frontend/`** - Frontend приложение (React + TypeScript)
- **`docs/`** - Документация проекта
- **`scripts/`** - SQL скрипты для инициализации БД
- **`analytics/`** - Конфигурация dbt и аналитики
- **`.github/`** - GitHub Actions workflows
- **`nextstayos/`** - Старая структура проекта (legacy)

---

## 🔧 Backend (`backend/`)

### Конфигурация
- **`Dockerfile`** - Образ Docker для Backend контейнера
- **`requirements.txt`** - Python зависимости (FastAPI, SQLAlchemy, JWT, BCrypt и др.)
- **`.gitignore`** - Игнорируемые файлы Backend

### Скрипты и данные
- **`init_db_v1.sql`** - SQL скрипт создания пользователей для Superset
- **`mock_data.json`** - Тестовые данные (legacy)
- **`test_db.py`** - Скрипт для тестирования подключения к БД

### Приложение (`backend/app/`)

#### Основные файлы
- **`main.py`** - Точка входа FastAPI приложения, регистрация роутеров, CORS, создание таблиц
- **`exceptions.py`** - Обработчики исключений (HTTP, валидация, общие ошибки)

#### Конфигурация (`app/core/`)
- **`config.py`** - Настройки приложения, подключение к БД через переменные окружения

#### База данных (`app/db/`)
- **`base.py`** - Базовый класс SQLAlchemy для моделей
- **`session.py`** - Настройка сессий SQLAlchemy, подключение к PostgreSQL

#### Модели (`app/models/`)
- **`__init__.py`** - Экспорт всех моделей
- **`room.py`** - Модель Room (комнаты отеля: номер, категория, статус, цена, вместимость)
- **`booking.py`** - Модель Booking (бронирования: гость, комната, даты заезда/выезда, статус)
- **`task.py`** - Модель CleaningTask (задачи уборки: комната, статус, приоритет, исполнитель)
- **`guest_token.py`** - Модель GuestToken (токены для гостей: WiFi, контакты, инструкции, правила)

#### API (`app/api/v1/`)
- **`health.py`** - Health check эндпоинт (`GET /api/v1/health`)
- **`auth.py`** - Аутентификация (заглушка): логин/логаут
- **`rooms.py`** - CRUD операции для комнат (`GET/POST/PATCH/DELETE /api/v1/rooms`)
- **`bookings.py`** - CRUD операции для бронирований, автоматическое создание токенов
- **`tasks.py`** - CRUD операции для задач уборки, назначение и завершение задач
- **`guest.py`** - API для гостей: получение данных по токену, checkout (создание задачи уборки)

#### Документация API (`app/api/v1/`)
- **`README.md`** - Описание API эндпоинтов (статус реализации)
- **`IMPLEMENTATION.md`** - Документация по реализованным CRUD операциям
- **`GUEST_BOOKING.md`** - Документация по Guest Token и Booking системе

---

## 🎨 Frontend (`frontend/`)

### Конфигурация
- **`package.json`** - Зависимости и скрипты (React, TypeScript, Vite, Axios, Zustand)
- **`vite.config.ts`** - Конфигурация Vite (сборщик)
- **`tsconfig.json`** - Настройки TypeScript
- **`tailwind.config.js`** - Конфигурация Tailwind CSS
- **`postcss.config.js`** - Конфигурация PostCSS
- **`eslint.config.js`** - Настройки ESLint
- **`.env.example`** - Пример переменных окружения (Mock API, URL бэкенда)
- **`index.html`** - HTML шаблон приложения

### Исходный код (`frontend/src/`)

#### Точки входа
- **`main.tsx`** - Точка входа React приложения, настройка темы (dark/light), Toast уведомления
- **`App.tsx`** - Корневой компонент, обертка над роутером
- **`index.css`** - Глобальные стили, Tailwind директивы

#### API (`src/api/`)
- **`http.ts`** - HTTP клиент (Axios), настройка базового URL, interceptors
- **`api.ts`** - API функции для всех эндпоинтов (rooms, bookings, tasks, auth, guest)
- **`mockApi.ts`** - Mock API для разработки без бэкенда

#### Роутинг (`src/router/`)
- **`index.tsx`** - Конфигурация React Router, защищенные маршруты, роли
- **`IndexRedirect.tsx`** - Компонент редиректа с главной страницы

#### Страницы (`src/pages/`)
- **`LoginPage.tsx`** - Страница авторизации
- **`NotFoundPage.tsx`** - Страница 404
- **`admin/AdminPage.tsx`** - Главная страница администратора (управление комнатами)
- **`admin/BookingsPage.tsx`** - Страница управления бронированиями
- **`staff/StaffPage.tsx`** - Страница персонала (задачи уборки)
- **`guest/GuestPage.tsx`** - Страница гостя (доступ по токену, QR код, checkout)
- **`reports/ReportsPage.tsx`** - Страница отчетов и аналитики

#### Компоненты (`src/components/`)
- **`ProtectedRoute.tsx`** - Компонент защиты маршрутов по ролям
- **`Header.tsx`** - Шапка приложения (навигация, пользователь)
- **`Sidebar.tsx`** - Боковое меню навигации
- **`RoomCard.tsx`** - Карточка комнаты
- **`TaskCard.tsx`** - Карточка задачи уборки

#### UI компоненты (`src/ui/`)
Переиспользуемые компоненты дизайн-системы:
- **`Button.tsx`** - Кнопка
- **`Card.tsx`** - Карточка
- **`Modal.tsx`** - Модальное окно
- **`Drawer.tsx`** - Выдвижная панель
- **`LoadingSpinner.tsx`** - Индикатор загрузки
- **`ErrorState.tsx`** - Состояние ошибки
- **`EmptyState.tsx`** - Пустое состояние
- **`PageHeader.tsx`** - Заголовок страницы

#### Лейауты (`src/layouts/`)
- **`AppLayout.tsx`** - Основной лейаут приложения (Header + Sidebar + контент)

#### Хранилище (`src/store/`)
- **`authStore.ts`** - Zustand store для состояния аутентификации (токен, роль, пользователь)

#### Константы (`src/constants/`)
- **`designTokens.ts`** - Дизайн-токены (цвета, отступы, типографика)

#### Моки (`src/mocks/`)
- **`index.ts`** - Экспорт всех моков
- **`rooms.ts`** - Mock данные комнат
- **`bookings.ts`** - Mock данные бронирований
- **`tasks.ts`** - Mock данные задач
- **`guest.ts`** - Mock данные гостя

---

## 📚 Документация (`docs/`)

- **`srs.md`** - Software Requirements Specification (требования к системе)
- **`architecture.md`** - Архитектура системы (SOA, компоненты, категории функциональности)
- **`frontend-backend-integration.md`** - Инструкция по интеграции фронтенда и бэкенда
- **`diagrams/database_schema.md`** - Описание схемы БД
- **`diagrams/Database_schema.pdf`** - PDF схема БД

---

## 🗄️ База данных (`scripts/`)

- **`init-db.sql`** - SQL скрипт инициализации БД (создание пользователя для Superset)

---

## 📊 Аналитика (`analytics/`)

- **`Dockerfile`** - Образ для аналитического контейнера
- **`Dockerfile.dbt`** - Образ для dbt контейнера
- **`profiles.yml`** - Конфигурация dbt (подключение к БД)

---

## 🔄 CI/CD (`.github/workflows/`)

- **`main.yml`** - GitHub Actions workflow (автоматизация деплоя/тестов)

---

## 📝 Дополнительные файлы

- **`.pre-commit-config.yaml`** - Конфигурация pre-commit хуков
- **`updates/`** - Временные файлы обновлений (можно удалить)

---

## 🏗️ Архитектура проекта

```
NextStay/
├── backend/          # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/  # REST API эндпоинты
│   │   ├── models/  # SQLAlchemy модели
│   │   ├── db/      # Подключение к БД
│   │   └── core/    # Конфигурация
│   └── requirements.txt
│
├── frontend/         # React Frontend
│   └── src/
│       ├── pages/   # Страницы приложения
│       ├── components/  # Бизнес-компоненты
│       ├── ui/      # UI компоненты
│       ├── api/     # API клиент
│       └── store/   # State management
│
├── docs/            # Документация
├── scripts/          # SQL скрипты
├── analytics/        # dbt конфигурация
└── docker-compose.yml  # Оркестрация контейнеров
```

---

## 🔑 Ключевые технологии

**Backend:**
- FastAPI - веб-фреймворк
- SQLAlchemy - ORM
- PostgreSQL - БД
- JWT (python-jose) - аутентификация
- BCrypt (passlib) - хеширование паролей

**Frontend:**
- React 19 - UI библиотека
- TypeScript - типизация
- Vite - сборщик
- React Router - роутинг
- Zustand - state management
- Tailwind CSS - стилизация
- Axios - HTTP клиент

**Инфраструктура:**
- Docker & Docker Compose - контейнеризация
- PostgreSQL 15 - БД
- Apache Superset - BI платформа
- dbt - трансформации данных
