#!/bin/bash

# 1. Надежная загрузка переменных из .env
if [ -f .env ]; then
    # Читаем файл, убираем пробелы и экспортируем переменные
    export $(grep -v '^#' .env | xargs)
    echo "✅ Переменные из .env загружены"
else
    echo "❌ Ошибка: Файл .env не найден в корне проекта!"
    exit 1
fi

# Дефолтные значения, если в .env что-то не прописано
DB_USER=${DB_USER:-admin}
DB_PASSWORD=${DB_PASSWORD:-nextstay_secure_pass}
DB_NAME=${DB_NAME:-nextstay_db_v2}
AIRFLOW_ADMIN_USER=${AIRFLOW_ADMIN_USER:-admin}
AIRFLOW_ADMIN_PASSWORD=${AIRFLOW_ADMIN_PASSWORD:-admin}
SUPERSET_ADMIN_USER=${SUPERSET_ADMIN_USER:-admin}
SUPERSET_ADMIN_PASSWORD=${SUPERSET_ADMIN_PASSWORD:-admin}

echo "🚀 Начинаю глобальную настройку NextStay Infrastructure..."

# 2. Проверка Базы Данных
echo "🐘 Проверяю доступность Postgres ($DB_NAME)..."
until docker exec nextstay_db_clean pg_isready -U $DB_USER; do
  echo "Ожидаю запуск БД..."
  sleep 2
done

# 3. Настройка Airflow (удаление и создание для чистоты)
echo "🔑 Настройка Airflow (логин: $AIRFLOW_ADMIN_USER)..."
docker exec nextstay_airflow airflow users delete --username $AIRFLOW_ADMIN_USER 2>/dev/null || true
docker exec nextstay_airflow airflow users create \
    --username "$AIRFLOW_ADMIN_USER" \
    --password "$AIRFLOW_ADMIN_PASSWORD" \
    --firstname Admin \
    --lastname NextStay \
    --role Admin \
    --email admin@nextstay.com

# 4. Настройка Superset
echo "📊 Настройка Superset (логин: $SUPERSET_ADMIN_USER)..."
# Установка драйвера в venv
docker exec --user root nextstay_superset pip install psycopg2-binary --target /app/.venv/lib/python3.10/site-packages

# Создание админа (игнорируем ошибку если уже есть)
docker exec nextstay_superset superset fab create-admin \
    --username "$SUPERSET_ADMIN_USER" \
    --firstname Admin \
    --lastname Superset \
    --email admin@superset.com \
    --password "$SUPERSET_ADMIN_PASSWORD" || echo "Пользователь Superset уже существует"

docker exec nextstay_superset superset db upgrade
docker exec nextstay_superset superset init

# 5. Создание Read-Only пользователя (Issue #22)
echo "👤 Создаю Read-Only пользователя для Superset..."
docker exec -it nextstay_db_clean psql -U "$DB_USER" -d "$DB_NAME" -c "
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'superset_ro') THEN
            CREATE USER superset_ro WITH PASSWORD 'read_only_pass';
        END IF;
    END \$\$;
    GRANT CONNECT ON DATABASE $DB_NAME TO superset_ro;
    GRANT USAGE ON SCHEMA public TO superset_ro;
    GRANT USAGE ON SCHEMA oltp TO superset_ro;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO superset_ro;
    GRANT SELECT ON ALL TABLES IN SCHEMA oltp TO superset_ro;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO superset_ro;
    ALTER DEFAULT PRIVILEGES IN SCHEMA oltp GRANT SELECT ON TABLES TO superset_ro;
"

# 6. Настройка dbt
echo "📉 Настройка dbt..."
docker exec nextstay_dbt dbt deps

echo "✨ ВСЁ ГОТОВО! ✨"
echo "Airflow: http://localhost:8080 ($AIRFLOW_ADMIN_USER / $AIRFLOW_ADMIN_PASSWORD)"
echo "Superset: http://localhost:8088 ($SUPERSET_ADMIN_USER / $SUPERSET_ADMIN_PASSWORD)"
echo "DB: $DB_NAME (Port: 5433)"
