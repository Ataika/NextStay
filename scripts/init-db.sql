-- creating user for  Superset (Read-Only)
CREATE USER superset_ro WITH PASSWORD 'superset_pass';
GRANT CONNECT ON DATABASE nextstay TO superset_ro;

-- After creating the dbt schema, we will give the permission to  SELECT
-- We will integrate it in  Milestone 2
