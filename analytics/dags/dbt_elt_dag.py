"""NextStay ELT orchestration — runs the dbt warehouse build on a schedule.

Pipeline: OLTP (public.*) -> stg (views) -> core (dims + fct + SCD snapshot) -> mart
(occupancy / RevPAR / loyalty), consumed by Superset.

dbt runs against the PostgreSQL prod target. The dbt project + profiles are mounted
into the Airflow container at /opt/airflow/dbt (see docker-compose.yml). dbt itself is
installed via the airflow service's _PIP_ADDITIONAL_REQUIREMENTS.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

DBT_DIR = "/opt/airflow/dbt"
# --profiles-dir points at the same mounted dir; --target postgres uses DBT_PG_* env
# (set on the airflow service) to reach the `db` service inside the compose network.
DBT = f"dbt {{cmd}} --project-dir {DBT_DIR} --profiles-dir {DBT_DIR} --target postgres --no-use-colors"

default_args = {
    "owner": "atai",
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
}

with DAG(
    dag_id="nextstay_dbt_elt",
    description="Build the NextStay dbt warehouse (stg -> core -> mart) on PostgreSQL",
    default_args=default_args,
    schedule_interval="0 3 * * *",  # nightly at 03:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["nextstay", "dbt", "elt", "dwh"],
) as dag:
    dbt_seed = BashOperator(
        task_id="dbt_seed",
        bash_command=DBT.format(cmd="seed"),
    )

    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command=DBT.format(cmd="run"),
    )

    dbt_snapshot = BashOperator(
        task_id="dbt_snapshot",
        bash_command=DBT.format(cmd="snapshot"),
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=DBT.format(cmd="test"),
    )

    dbt_seed >> dbt_run >> dbt_snapshot >> dbt_test
