# NextStay — Цели и задачи

## Главная цель

Довести проект до завершённого состояния и подготовить **отчёт по Software Engineering на 160+ страниц**.
Атай отвечает за **всю БД-часть [DB]** во всех спринтах + новую задачу синхронизации/симулятора.

---

## Спринты (полный план команды)

### Sprint 2 — Rooms, Inventory & Booking Core (~10 дней)
Цель: гость может смотреть номера, захолдить один и завершить бронь.

| Задача | Owner | Дни |
|---|---|---|
| **[DB] rooms, bookings, guest_tokens models** | **Atai** | 2 |
| **[DB] FK constraints + indexes на room_id, check_in/out** | **Atai** | 1 |
| [BE] Room CRUD endpoints (`/rooms`) | Dair | 2 |
| [BE] Inventory setup endpoint + availability logic | Dair | 2 |
| [BE] Booking create/confirm/cancel + hold system | Dair | 3 |
| [BE] Guest token generation endpoint | Dair | 1 |
| [FE] BookingPage (date picker, выбор номера) | Turat | 3 |
| [FE] BookingSuccessPage + BookingCancelPage | Turat | 1 |
| [FE] RoomCard + InventorySetupPage | Turat | 2 |

### Sprint 3 — Pricing Engine (~12 дней, самый сложный)
Цель: админ обучает per-hotel pricing-модель, публикует динамические цены, видит их в Pricing Lab.

| Задача | Owner | Дни |
|---|---|---|
| **[DB] Pricing tables (hotel pricing seed, model registry)** | **Atai** | 3 |
| **[DB] Synthetic data generation script** | **Atai** | 2 |
| [BE] Feature engineering + ML training pipeline | Dair | 3 |
| [BE] Price optimizer + rules engine | Dair | 2 |
| [BE] Pricing Lab API (`/pricing_lab`) — publish/fetch | Dair | 2 |
| [BE] Pricing config + pipeline endpoints | Dair | 1 |
| [BE] Model backtesting + champion promotion | Dair | 1 |
| [FE] PricingLabPage | Turat | 3 |
| [FE] ModelTrainingPage + PricingConfigPage | Turat | 2 |
| [FE] EngineHubPage | Turat | 1 |

### Sprint 4 — Staff, Shifts & Task Management (~10 дней)
Цель: менеджеры ставят смены, задачи раздаются round-robin, персонал стартует смены.

| Задача | Owner | Дни |
|---|---|---|
| **[DB] tasks table + staff fields на User** | **Atai** | 2 |
| **[DB] Shift tracking columns / shift session model** | **Atai** | 1 |
| [BE] Staff CRUD + role management (`/staff`) | Dair | 2 |
| [BE] Shift start/end endpoints | Dair | 1 |
| [BE] Round-robin task assignment (`/tasks`) | Dair | 2 |
| [BE] task_utils — task state machine | Dair | 1 |
| [FE] StaffPlannerPage | Turat | 2 |
| [FE] StaffPage + ShiftStartPage | Turat | 2 |
| [FE] TaskCard + useTaskNotifications | Turat | 2 |

### Sprint 5 — Payments, Guest Portal & Polish (~10 дней)
Цель: end-to-end платная бронь; гость получает email; доступ по токен-ссылке; админ видит отчёты.

| Задача | Owner | Дни |
|---|---|---|
| **[DB] Stripe fields на bookings (session_id, intent_id, amount)** | **Atai** | 1 |
| **[DB] Email OTP table cleanup + seeding scripts** | **Atai** | 1 |
| [BE] Stripe checkout session + webhook | Dair | 3 |
| [BE] Email service (OTP delivery) | Dair | 1 |
| [BE] `/guest` token-gated endpoints | Dair | 1 |
| [FE] GuestPage (по токену, без логина) | Turat | 2 |
| [FE] AdminPage dashboard (KPIs) | Turat | 2 |
| [FE] ReportsPage (bookings/revenue) | Turat | 2 |
| [FE] SettingsPage + Header polish + mobile | Turat | 2 |

---

## Задачи Атая (сводка [DB] по всем спринтам)

- [ ] S2: модели `rooms`, `bookings`, `guest_tokens`
- [ ] S2: FK + индексы (`room_id`, `check_in/out`)
- [ ] S3: pricing-таблицы (hotel pricing seed, model registry)
- [ ] S3: скрипт генерации синтетических данных
- [ ] S4: `tasks` + staff-поля на `User`
- [ ] S4: shift tracking / shift session model
- [ ] S5: Stripe-поля на `bookings`
- [ ] S5: чистка email OTP + seed-скрипты

> Статус по факту см. `STATE.md` — многое уже реализовано в коде; нужно сверить, добить пробелы и **задокументировать для отчёта**.

---

## Новая задача — Симулятор синхронизации отелей

**Идея:** наш PMS и сайт отеля должны быть синхронизированы. Если номер забронировали на стороне отеля —
у нас тоже должно отображаться «забронировано», и наоборот.

Подзадачи:
1. **Симулятор отправки данных с отелей** — сервис эмулирует поток событий отеля (бронь / отмена / изменение статуса номера) и шлёт их в наш API.
2. **Синхронизация** — наш сервис принимает события и обновляет состояние (`rooms.status`, `bookings`, `inventory_snapshots`).
3. (Опционально) **Примитивный сайт бронирования** — мини-фронт «сайт отеля», где можно забронировать номер, чтобы наглядно продемонстрировать двустороннюю синхронизацию.

Открытые вопросы (уточнить у Атая): протокол синхронизации (webhook / polling / очередь), сколько «отелей»-источников, нужна ли двусторонность или односторонний поток отель→PMS.

---

## Требования к отчёту

- Объём: **160+ страниц**.
- Уже есть готовый **Word-файл** — нужно **добавить в него работу Атая (DB-часть)**.
- **Везде где уместно — диаграммы** (Mermaid) для понимания процессов: ER-диаграмма схем, поток данных DWH, sequence бронирования/холда/оплаты, pricing-пайплайн, синхронизация отелей.
- Раздел **9. Website Mock-ups**: 9.1 PC Browser (Admin, Booking, Guest, Staff), 9.2 Mobile (адаптив).
- Базовая mermaid-диаграмма процессов (от Атая): https://mermaid.live/view#pako:eNp9lFtvmzAUx78K8hOVcoEmJZeHSW1uTUuatMnTnAk5wSXWwEY2VMuqSvsQ-4T7JDvYTeZsXXgAfuf8fW7YvKKtiCnqo0SSfOeshmvuwKXKjTHMw9UCr1H1cEKyp3KNvhhJdV1jVwqRqQvLdoPdjRBfGU-OZsrjNf8r8EBICoGrhzNkGeWKCa4cdyFUkUi6fAwvTlINsBuzLNqJgqYn-YbGUdURFfucns26YDlNGa8yLyTbQpFH00m2EZ7yF8oLIfdQaZrSLbxa_jEeU1KUUPuIJ7CY2s4JHhAes5gU1JlQTiU5XXyLZzDz1FluoXnbMcU3pYJoSjlPZUrVmUZmIbQwCz_4JnfYzdJGbrqDGog9rHu8koTxqu87sbEcIXb1aKOsKi2SNGGqkPtzs1xCVySxR_lu-f9HnGGXHeYaKU5yBUlPvuYDdqvSaRTTLdNbwvbOwVtuUqZ2NI607sS9ODTx3n20FfyZJeeauF5MoQG4fzDJR9x8D-T8-vHTkSWvH2puWrIn3CwOQ460Ot1B-DDgaPj0-V1g
