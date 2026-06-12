select
    hotel_id,
    hotel_code,
    hotel_name,
    is_active
from {{ ref('stg_hotels') }}
