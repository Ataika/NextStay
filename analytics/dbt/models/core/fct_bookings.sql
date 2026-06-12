select
    b.booking_id,
    b.guest_email,
    b.room_id,
    r.hotel_id,
    b.booking_status,
    b.check_in_date,
    b.check_out_date,
    b.amount_paid,
    b.created_date,
    cast(b.check_out_date as date) - cast(b.check_in_date as date) as nights,
    case
        when b.booking_status not in ('Cancelled', 'Expired') then b.amount_paid
        else 0
    end as realized_revenue
from {{ ref('stg_bookings') }} as b
left join {{ ref('stg_rooms') }} as r on b.room_id = r.room_id
