#!/bin/bash

# Загружаем переменные из .env
export $(grep -v '^#' .env | xargs)

echo "🚀 Начинаю глобальную настройку NextStay Infrastructure..."

# 1. Проверка Базы Данных
echo "🐘 Проверяю доступность Postgres..."
until docker exec nextstay_db_clean pg_isready -U $DB_USER; do
  echo "Ожидаю запуск БД..."
  sleep 2
done

# 2. Настройка Airflow
echo "🔑 Настройка Airflow (логин: $AIRFLOW_ADMIN_USER)..."
docker exec nextstay_airflow airflow users create \
    --username $AIRFLOW_ADMIN_USER \
    --password $AIRFLOW_ADMIN_PASSWORD \
    --firstname Admin \
    --lastname NextStay \
    --role Admin \
    --email admin@nextstay.com || \
docker exec nextstay_airflow airflow users chpass \
    --username $AIRFLOW_ADMIN_USER \
    --password $AIRFLOW_ADMIN_PASSWORD

# 3. Настройка Superset
echo "📊 Настройка Superset (логин: $SUPERSET_ADMIN_USER)..."
# Установка драйвера
docker exec --user root nextstay_superset pip install psycopg2-binary --target /app/.venv/lib/python3.10/site-packages
# Создание админа
docker exec nextstay_superset superset fab create-admin \
    --username $SUPERSET_ADMIN_USER \
    --firstname Admin \
    --lastname Superset \
    --email admin@superset.com \
    --password $SUPERSET_ADMIN_PASSWORD
docker exec nextstay_superset superset db upgrade
docker exec nextstay_superset superset init

# 4. Настройка dbt
echo "📉 Настройка dbt..."
docker exec nextstay_dbt dbt deps

echo "✨ ВСЁ ГОТОВО! ✨"
echo "Airflow: http://localhost:8080 ($AIRFLOW_ADMIN_USER / $AIRFLOW_ADMIN_PASSWORD)"
echo "Superset: http://localhost:8088 ($SUPERSET_ADMIN_USER / $SUPERSET_ADMIN_PASSWORD)"
echo "DB Port: 5433"
