with occ as (
    select * from {{ ref('mart_occupancy') }}
),

revenue as (
    select
        r.hotel_id,
        d.date_key,
        sum(f.realized_revenue * 1.0 / nullif(f.nights, 0)) as room_revenue
    from {{ ref('fct_bookings') }} as f
    inner join {{ ref('dim_rooms') }} as r on f.room_id = r.room_id
    inner join {{ ref('dim_dates') }} as d
        on f.check_in_date <= d.date_key and f.check_out_date > d.date_key
    where f.booking_status not in ('Cancelled', 'Expired')
    group by r.hotel_id, d.date_key
)

select
    occ.hotel_id,
    occ.date_key,
    occ.available_rooms,
    coalesce(rev.room_revenue, 0) as room_revenue,
    round(cast(coalesce(rev.room_revenue, 0) / nullif(occ.available_rooms, 0) as numeric), 2) as revpar
from occ
left join revenue as rev on occ.hotel_id = rev.hotel_id and occ.date_key = rev.date_key
