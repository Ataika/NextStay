with source as (
    select * from {{ ref('seed_hotels') }}
)

select
    id as hotel_id,
    code as hotel_code,
    name as hotel_name,
    active as is_active,
    current_timestamp as dbt_loaded_at
from source
