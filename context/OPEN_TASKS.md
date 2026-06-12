# NextStay — Open Tasks (по ответственным)

Состояние тестов на 2026-06-12: **167 автоматических проверок зелёные** —
backend 101, hotelsim 13, system/e2e 4, dbt 49. Ниже — оставшиеся недочёты/пробелы.

Приоритет: P1 (высокий) · P2 (средний) · P3 (низкий). Статус: TODO / IN PROGRESS / DONE.

| ID | Задача | Ответственный | Приор. | Статус | Примечание |
|---|---|---|---|---|---|
| T-01 | Системные E2E-тесты сделать идемпотентными (уникальные даты) | Atai | P1 | ✅ DONE | `f35616a` — было: 409 overbooking при повторном прогоне |
| T-02 | **Фронтенд-тесты (React)**: их сейчас НЕТ вовсе — добавить Vitest + React Testing Library по ключевым страницам (Login/OTP, Booking, Guest, Admin) | Turat | P1 | TODO | пробел в главе тестирования; нет защиты от регрессий UI |
| T-03 | Интеграция `origin/latest` (мульти-арендность тиммейта): свести **дублирующий `hotel_id`/rooms** и tenancy с нашей веткой одним общим коммитом | Atai + Dair | P1 | TODO | обе ветки независимо добавили hotel_id; конфликты в room.py/rooms.py/bookings.py/conftest/main/models |
| T-04 | Свести `init-db.sql`/bootstrap, чтобы свежий `docker compose up` не падал на users (наш локальный фикс vs «migration backfill» из origin/latest) | Dair + Atai | P2 | PARTIAL | у нас fresh-init чинён локально (`ff91bea`); при merge origin/latest свести подходы |
| T-05 | Скриншоты в отчёт: разделы 9 (PC/Mobile), 10.5 (Superset dashboard), 11 — заменить `[Insert screenshot]` | Atai (+Turat по UI) | P2 | TODO | стек поднят: localhost:5173 / 8088 |
| T-06 | Быстрый тест inbound-флоу `hotel_sync.py` (JSONB) — сейчас покрыт только system/e2e (нужен живой PG); добавить уровень integration (PG-фикстура или мок) | Atai + Dair | P2 | TODO | unit/SQLite его не покрывает |
| T-07 | CI: гонять backend pytest + (опц.) поднимать сервисы для system/dbt; сейчас `main.yml` делает только `dbt parse` (non-blocking) | Dair | P2 | TODO | проверить, что backend-тесты реально в CI |
| T-08 | Тех-долг: Pydantic v2 deprecations (`.dict()`→`model_dump` в bookings.py), `@app.on_event`→lifespan в main.py | Dair | P3 | TODO | 34 warnings в pytest |
| T-09 | Airflow: запекать dbt в образ (Dockerfile) вместо `_PIP_ADDITIONAL_REQUIREMENTS` на старте (быстрее, durable) | Atai | P3 | TODO | сейчас ставится при каждом старте |
| T-10 | dbt prod-from-OLTP: snapshots/freshness и расписание сверх ночного DAG; проверить mart на больших данных | Atai | P3 | TODO | staging уже читает public.* на postgres |

## Как распределяли
- **Atai (Data/BI):** T-01✅, T-03, T-05, T-06, T-09, T-10 (+ соведение T-04).
- **Dair (Backend):** T-04, T-07, T-08 (+ соведение T-03, T-06).
- **Turat (Frontend):** T-02, помощь по T-05 (UI-скриншоты).

## GitHub Issues (заведены, Ataika/NextStay)
- T-02 → [#45](https://github.com/Ataika/NextStay/issues/45) — gew1nn (Turat), P1
- T-03 → [#46](https://github.com/Ataika/NextStay/issues/46) — Ataika + ItzDair, P1
- T-04 → [#47](https://github.com/Ataika/NextStay/issues/47) — ItzDair + Ataika, P2
- T-05 → [#48](https://github.com/Ataika/NextStay/issues/48) — Ataika, P2
- T-06 → [#49](https://github.com/Ataika/NextStay/issues/49) — Ataika + ItzDair, P2
- T-07 → [#50](https://github.com/Ataika/NextStay/issues/50) — ItzDair, P2
- T-08 → [#51](https://github.com/Ataika/NextStay/issues/51) — ItzDair, P3
- T-09 → [#52](https://github.com/Ataika/NextStay/issues/52) — Ataika, P3
- T-10 → [#53](https://github.com/Ataika/NextStay/issues/53) — Ataika, P3

(T-01 — идемпотентность системных тестов — ✅ DONE, без issue.)

> Обновлять статусы здесь и в GitHub Issues по ходу.
