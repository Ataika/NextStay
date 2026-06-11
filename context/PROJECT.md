# NextStay — Паспорт проекта

**NextStay** 🏨 — Property Management System (PMS) для отелей: автоматизация операций,
оптимизация процессов, бизнес-аналитика и динамическое ценообразование.

Учебный проект по Software Engineering. Команда из 3 человек.

## Команда и роли

| Участник | Зона | Активность |
|---|---|---|
| **Dair** | Backend — API endpoints, auth, pricing engine, Stripe, task logic | Все 5 спринтов |
| **Turat** | Frontend — все страницы, компоненты, роутинг, state | Все 5 спринтов |
| **Atai (я, владелец)** | Database — SQLAlchemy-модели, дизайн схем, миграции, seed/синтетика, dbt/DWH/BI | 1–5 (фундамент в 1–2) |

## Стек

| Слой | Технология |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind (Vite) |
| Backend | FastAPI + SQLAlchemy + PostgreSQL 15 |
| Migrations | Raw SQL migration files |
| Transformations | dbt Core |
| Orchestration | Apache Airflow |
| BI | Apache Superset |
| Infra | Docker & Docker Compose |
| Pricing/ML | Python (scikit-learn: RandomForest, ExtraTrees, LogReg) |

## Архитектура БД — 6 схем

### `public` — OLTP (source of truth)

| Таблица | Назначение |
|---|---|
| `rooms` | Инвентарь номеров (номер, категория, статус, цена, вместимость, удобства) |
| `bookings` | Брони (гость, check-in/out, Stripe session, оплаченная сумма) |
| `room_holds` | 10-минутные холды до оплаты |
| `tasks` | Задачи уборки с приоритетом и назначением |
| `guest_tokens` | Токен-доступ гостя к порталу (WiFi, инструкции, правила) |
| `users` | Аккаунты персонала/админа (email, роль, password hash) |
| `auth_sessions` | Отзыв JWT по JTI |
| `email_otps` | OTP-коды: срок, счётчик попыток, флаг использования |
| `staff_members` | Профили персонала, связь с users |
| `staff_shifts` | График смен + типы смен |

### `stg` — Staging
Зеркало OLTP-таблиц + технические ETL-колонки (load timestamps, source tracking) для ингеста dbt.

### `core` — Dimensional Warehouse
`dim_hotels`, `dim_room_types`, `dim_dates` — измерения. Поддержка SCD (историчность).

### `mart` — Analytics Marts
Occupancy, Loyalty analytics, RevPAR (Revenue per Available Room), агрегаты для дашбордов Superset.

### `ml` — Machine Learning
`pricingdata` — feature-engineered тренировочный датасет (occupancy, day-of-week, сезонность, история ставок).

### `pricing` — Pricing Engine

| Таблица | Назначение |
|---|---|
| `inventory_snapshots` | Снимки доступности номеров на момент времени |
| `price_decisions` | Ценовое решение на номер/дату со всеми входами в лог |
| `published_prices` | Финальные активные цены для движка бронирования |
| `hotel_pricing_config` | Per-hotel min/max цена и множители правил |
| `hotel_model_registry` | Метаданные обученной ML-модели и статус промоушена |
| `training_jobs` | Статус асинхронных тренировочных задач |

## Поток данных

```
OLTP (public) → STG (staging) → dbt transforms → CORE (dims) + MART (aggregates)
                                                              ↓
                                                   Superset dashboards

OLTP → ML schema (feature eng.) → training jobs → hotel_model_registry
                                                            ↓
                          inventory_snapshots → pricing pipeline → published_prices
```

## Доступы (dev)

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1 · docs: /docs
- Airflow: http://localhost:8080
- Superset: http://localhost:8088
- Запуск: `docker compose up -d`
