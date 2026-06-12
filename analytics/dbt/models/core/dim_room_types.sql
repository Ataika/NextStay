select
    hotel_id,
    room_category,
    md5(cast(hotel_id as varchar) || '-' || room_category) as room_type_key,
    count(*) as room_count,
    min(price_per_night) as min_price,
    max(price_per_night) as max_price
from {{ ref('stg_rooms') }}
group by hotel_id, room_category
