-- dbt_nexstay/models/staging/stg_rooms.sql

WITH source AS (
    SELECT * FROM {{ source('nexstay_source', 'rooms') }}
)

SELECT
    room_id,
    tenant_id,
    room_number,
    room_type,
    status,
    price_per_night,
    created_at,
    -- Добавляем техническое поле
    CURRENT_TIMESTAMP AS dbt_loaded_at
FROM source
