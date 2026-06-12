{% snapshot scd_rooms %}
{{
    config(
        target_schema='core',
        unique_key='room_id',
        strategy='check',
        check_cols=['price_per_night', 'room_status', 'room_category']
    )
}}
select
    room_id,
    hotel_id,
    room_number,
    room_category,
    room_status,
    capacity,
    price_per_night
from {{ ref('stg_rooms') }}
{% endsnapshot %}
