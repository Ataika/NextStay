# Superset image with the PostgreSQL driver baked in (base image ships none),
# so the warehouse connection works on a fresh `docker compose up --build`.
FROM apache/superset:6.0.0

USER root
RUN uv pip install --python /app/.venv/bin/python psycopg2-binary
USER superset
