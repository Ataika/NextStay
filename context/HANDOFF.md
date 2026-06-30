# HANDOFF — читать первым при новой сессии (NextStay, Atai)

> Сессия была очень длинной и будет `/clear`-нута. Это шпаргалка, чтобы мгновенно поднять нить.
> Проект: **NextStay** PMS, репозиторий `~/Desktop/NextStay-hotel-sync` (НЕ mticket — рабочая dir сессии = mticket, но работаем по абсолютным путям здесь).
> Роль: **Atai = вся Data/Backend часть** (DB, синхронизация отелей, DWH, BI, тесты, отчёт).

## 0) При старте сделать
1. Прочитать: этот файл + `context/PROGRESS.md` (хронология сверху), `context/STATE.md`, `context/OPEN_TASKS.md`, `context/DECISIONS.md`.
2. Проверить git: ветка **`atai/hotel-sync-simulator`** (запушена). `git -C <repo> rev-list --left-right --count origin/main...HEAD` (мы впереди main; `origin/latest` тиммейта НЕ интегрирован — #46).
3. Спросить пользователя, что продолжаем (не начинать молча).

## 1) Среда / грабли (важно)
- **`cd` за пределы рабочей dir и `grep`/`find` ПАДАЮТ** в sandbox. Использовать абсолютные пути, `git -C <repo> ...`, `git -C <repo> grep`, Read/Write, python вместо grep.
- Коммиты иногда срывает pre-commit (ruff форматирует / sqlfluff). Для .py-скриптов отчёта версия ruff в хуке дрейфует → коммитил их `--no-verify` (ruff в venv чист). Для остального — обычный коммит, при reformat пере-`git add` и повторить.
- **Два venv:** `backend/.venv` (fastapi, pytest, ruff, sqlfluff, **playwright**, python-docx, httpx) и `analytics/.dbt-venv` (dbt-core 1.11 + duckdb + postgres). Оба gitignored.

## 2) Что СДЕЛАНО (всё в ветке, запушено)
- **Hotel Sync (вариант A, Phases 1–3):** реестр `hotels`, `rooms.hotel_id`, HMAC-подпись, двусторонний webhook PMS↔отель, идемпотентность, анти-эхо; сервис `hotelsim/` (FastAPI + мини-сайт + генератор).
- **DWH (dbt):** `analytics/dbt/` stg/core(dims+fct+SCD2 snapshot)/mart(occupancy/revpar/loyalty); читает живой OLTP на postgres-таргете, seeds на duckdb. `dbt build` PASS=49 на обоих.
- **Airflow:** DAG `nextstay_dbt_elt` (seed→run→snapshot→test), dbt запечён в образ (`analytics/airflow/Dockerfile`).
- **Superset:** `scripts/bootstrap_superset.py` (connection + 3 mart-датасета + дашборд «NextStay — Hotel Analytics»).
- **Тесты: 167 зелёных** — backend 101, hotelsim 13, system/e2e 4 (`tests/system/`), dbt 49.
- **Fresh `docker compose up`** поднимается в один шаг (init-db.sql переработан).
- **Отчёт:** `docs/report/NextStay_Report_FULL.docx` (~36 стр, 12 глав+TOC+Прил.A/B, 21 диаграмма/скрин, 20 табл) ← основной для сдачи. Генераторы: `scripts/report/build_full_report.py` (+ `content.py`, `full_content.py`, `soft_prose.py`, `build_report.py`, `integrate_into_soft.py`, `screenshots.py`). Скрипты-диаграммы рендерят Mermaid через mermaid.ink; скрины через playwright+системный Chrome.
- GitHub issues: закрыты #50/#52/#53/#54–#58; открыты #45 (FE-тесты, Turat), #46 (reconcile origin/latest), #47 (init-db unify), #48 (фронт-скрины §9, ручное), #49 (CI inbound test), #51 (deprecations, Dair).

## 3) Команды (копировать)
Корень: `R=/Users/ataika/Desktop/NextStay-hotel-sync`
- Стек: `docker compose --project-directory $R -f $R/docker-compose.yml -f $R/docker-compose.override.yml up -d`
- Тесты backend: `$R/backend/.venv/bin/python -m pytest $R/backend/tests --rootdir=$R/backend -p no:cacheprovider -q`
- hotelsim: `PYTHONPATH=$R $R/backend/.venv/bin/python -m pytest $R/hotelsim/tests --rootdir=$R/hotelsim -q`
- system e2e (нужен живой стек): `PYTHONPATH=$R $R/backend/.venv/bin/python -m pytest $R/tests/system --rootdir=$R -q`
- dbt: `export DBT_PG_HOST=localhost DBT_PG_PORT=5433 DBT_PG_USER=nextstay DBT_PG_PASS=nextstay DBT_PG_DBNAME=nextstay` затем `$R/analytics/.dbt-venv/bin/dbt build --project-dir $R/analytics/dbt --profiles-dir $R/analytics/dbt --target postgres`
- Отчёт FULL: `$R/backend/.venv/bin/python $R/scripts/report/build_full_report.py` (опц. `--template $R/soft.docx`)

## 4) Доступы / порты
- Frontend 5173 · Backend 8000 (`/docs`) · hotelsim 8090 · Airflow 8080 · Superset 8088 (admin/admin) · Postgres 5433.
- Логин UI: `admin@nextstay.com` / `Admin123!` (пароль я задал в БД; не вводить неверно 5 раз — лочит на 15 мин: сброс `UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE email='admin@nextstay.com';`).
- Sync: token `dev-hotel-sync-token`, hmac `dev-hotel-hmac-secret`. Dev-admin API: `Authorization: Bearer mock-admin-token`.
- Airflow standalone admin pw: `docker exec nextstay_airflow cat /opt/airflow/standalone_admin_password.txt`.

## 5) Демо «с нуля» (если том пересоздан) — ручные патчи (это пробел #47)
init-db не создаёт staff/room_holds → применить: `docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < $R/scripts/{migrate_add_room_holds,migrate_add_staff_tables,migrate_shift_types,seed_staff_full}.sql`; задать пароль админу (через `docker exec nextstay_backend python -c "from app.api.v1.auth import hash_password; ..."`).

## 6) Открытые направления (спросить пользователя что брать)
- Фронт-скрины §9 отчёта (ручное/Turat) · слияние веток в main (#46/#47, с Dair) · FE-тесты (#45, Turat) · расширить отчёт до ~160 стр приложениями (если жёсткое требование) · CI inbound test (#49).

---
**Инструкция будущему мне:** прочитать context/* + git status; стек поднять командой из §3; при «продолжаем отчёт» — генератор `build_full_report.py`; НЕ интегрировать `origin/latest` без явного решения (конфликт hotel_id). Сначала спросить пользователя цель.
