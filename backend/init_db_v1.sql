CREATE SCHEMA  IF NOT EXISTS  stg;
CREATE SCHEMA  IF NOT EXISTS  core;
CREATE SCHEMA  IF NOT EXISTS  mart;
CREATE SCHEMA  IF NOT EXISTS  logs;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'etl_user') THEN
    CREATE ROLE etl_user WITH LOGIN PASSWORD 'etl_password';
  END IF;
END $$;

GRANT ALL PRIVILEGES ON SCHEMA stg, core, mart, logs TO etl_user;


CREATE TABLE IF NOT EXISTS logs.etl_log (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(100),
    status VARCHAR(20),
    rows_inserted INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);