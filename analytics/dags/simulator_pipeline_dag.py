from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

import psycopg2
from airflow import DAG
from airflow.operators.python import PythonOperator

DAGS_DIR = Path("/opt/airflow/dags")
SQL_DIR = DAGS_DIR / "include" / "sql"

ROOMS_PER_COMPANY = int(os.getenv("SIM_ROOMS_PER_COMPANY", "80"))
BOOKINGS_PER_COMPANY = int(os.getenv("SIM_BOOKINGS_PER_COMPANY", "10000"))

DB_NAME = os.getenv("DB_NAME", "nextstay")
DB_USER = os.getenv("DB_USER", "nextstay")
DB_PASSWORD = os.getenv("DB_PASSWORD", "nextstay")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))


def _run_sql_file(filename: str, replacements: dict[str, str] | None = None) -> None:
    sql_path = SQL_DIR / filename
    sql = sql_path.read_text(encoding="utf-8")
    if replacements:
        for key, value in replacements.items():
            sql = sql.replace(key, value)

    with psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()


def bootstrap_simulator() -> None:
    _run_sql_file("bootstrap_simulator.sql")


def generate_oltp_data() -> None:
    _run_sql_file(
        "generate_oltp_data.sql",
        {
            "{{rooms_per_company}}": str(ROOMS_PER_COMPANY),
            "{{bookings_per_company}}": str(BOOKINGS_PER_COMPANY),
        },
    )


def load_stg() -> None:
    _run_sql_file("load_stg_from_oltp.sql")


def load_core() -> None:
    _run_sql_file("load_core_from_stg.sql")


def load_mart() -> None:
    _run_sql_file("load_mart_from_core.sql")


with DAG(
    dag_id="nextstay_simulator_pipeline",
    start_date=datetime(2026, 1, 1),
    schedule=None,
    catchup=False,
    tags=["nextstay", "simulator", "etl"],
) as dag:
    task_bootstrap = PythonOperator(
        task_id="bootstrap_simulator",
        python_callable=bootstrap_simulator,
    )

    task_generate = PythonOperator(
        task_id="generate_oltp_data",
        python_callable=generate_oltp_data,
    )

    task_stg = PythonOperator(
        task_id="load_stg_from_oltp",
        python_callable=load_stg,
    )

    task_core = PythonOperator(
        task_id="load_core_from_stg",
        python_callable=load_core,
    )

    task_mart = PythonOperator(
        task_id="load_mart_from_core",
        python_callable=load_mart,
    )

    task_bootstrap >> task_generate >> task_stg >> task_core >> task_mart
