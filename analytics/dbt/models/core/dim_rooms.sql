select
    room_id,
    hotel_id,
    room_number,
    room_category,
    room_status,
    capacity,
    price_per_night,
    md5(cast(hotel_id as varchar) || '-' || room_category) as room_type_key
from {{ ref('stg_rooms') }}
