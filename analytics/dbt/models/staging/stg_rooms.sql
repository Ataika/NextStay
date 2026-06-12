with source as (
    {% if target.type == 'postgres' %}
    select * from {{ source('oltp', 'rooms') }}
    {% else %}
    select * from {{ ref('seed_rooms') }}
    {% endif %}
)

select
    id as room_id,
    hotel_id,
    number as room_number,
    category as room_category,
    status as room_status,
    price as price_per_night,
    capacity,
    current_timestamp as dbt_loaded_at
from source
