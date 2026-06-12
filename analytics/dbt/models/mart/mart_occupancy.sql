with dates as (
    select date_key from {{ ref('dim_dates') }}
),

rooms as (
    select
        hotel_id,
        room_id
    from {{ ref('dim_rooms') }}
),

available as (
    select
        r.hotel_id,
        d.date_key,
        count(*) as available_rooms
    from rooms as r
    cross join dates as d
    group by r.hotel_id, d.date_key
),

occupied as (
    select
        r.hotel_id,
        d.date_key,
        count(distinct f.room_id) as occupied_rooms
    from {{ ref('fct_bookings') }} as f
    inner join {{ ref('dim_rooms') }} as r on f.room_id = r.room_id
    inner join dates as d
        on f.check_in_date <= d.date_key and f.check_out_date > d.date_key
    where f.booking_status not in ('Cancelled', 'Expired')
    group by r.hotel_id, d.date_key
)

select
    a.hotel_id,
    a.date_key,
    a.available_rooms,
    coalesce(o.occupied_rooms, 0) as occupied_rooms,
    round(coalesce(o.occupied_rooms, 0) * 1.0 / nullif(a.available_rooms, 0), 4) as occupancy_rate
from available as a
left join occupied as o on a.hotel_id = o.hotel_id and a.date_key = o.date_key
