# NextStay — План отчёта (160+ страниц)

Цель: дополнить готовый Word-файл DB-частью Атая и насытить диаграммами (Mermaid) везде, где помогает пониманию.

## Кандидаты-разделы (черновик; уточняем под существующий Word)

1. Introduction / Problem statement / Goals
2. Requirements (SRS) — из `docs/srs.md`
3. System Architecture — из `docs/architecture.md`
   - Mermaid: компонентная диаграмма (FE/BE/DB/dbt/Airflow/Superset)
4. **Database Design (Атай)** ← основной вклад
   - 6 схем: public / stg / core / mart / ml / pricing
   - **Mermaid ER-диаграмма** OLTP (`erDiagram`)
   - FK/индексы, ограничения
   - Миграции (порядок, назначение)
5. **Data Warehouse & dbt (Атай)**
   - **Mermaid flowchart** потока данных OLTP→STG→CORE→MART→Superset
   - dbt-модели: staging, dims (SCD), marts (occupancy, loyalty, RevPAR)
   - Тесты данных, snapshots
6. **Pricing Engine & ML**
   - **Mermaid** пайплайн: OLTP→ML feature eng→training_jobs→model_registry→published_prices
   - Модели, бэктест, champion promotion
7. Backend API (Dair) — обзор эндпоинтов
   - **Mermaid sequence**: бронирование (hold→pay→confirm), Stripe webhook, guest token
8. Frontend (Turat) — страницы, роутинг
9. **Website Mock-ups**
   - 9.1 PC Browser — Admin, Booking, Guest, Staff
   - 9.2 Mobile — адаптив
10. **Hotel Sync Simulator (Атай, новое)**
    - **Mermaid sequence**: hotel site → events → PMS sync → rooms/bookings/inventory
11. Testing, CI/CD (`.pre-commit`, `.github`, `.sqlfluff`)
12. Deployment (Docker Compose)
13. Conclusion / Future work

## Диаграммы к подготовке (Mermaid)

- [ ] ER-диаграмма OLTP (public)
- [ ] Компонентная диаграмма системы
- [ ] Поток данных DWH (OLTP→STG→CORE→MART→BI)
- [ ] Pricing/ML пайплайн
- [ ] Sequence: бронирование + холд + Stripe
- [ ] Sequence: guest token portal
- [ ] Sequence: синхронизация отелей
- [ ] State machine задач уборки (task_utils)
- [ ] SCD-обработка измерений

> Базовая mermaid-диаграмма процессов (Атай): см. ссылку в `GOALS.md`.

## Сделать с Word-файлом

- Получить путь/ссылку на актуальный Word.
- Вставить разделы 4, 5, 6, 10 (DB/DWH/ML/Sync) + диаграммы.
- Свести нумерацию и оглавление; добить объём до 160+ стр. за счёт детализации и листингов схем.
