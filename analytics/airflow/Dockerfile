# Airflow image with dbt baked in, so the ELT DAG runs without installing dbt
# at every container start (replaces _PIP_ADDITIONAL_REQUIREMENTS).
FROM apache/airflow:2.7.1-python3.10

RUN pip install --no-cache-dir dbt-postgres==1.9.0
