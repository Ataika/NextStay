with guest_realized as (
    select
        g.guest_email,
        g.guest_name,
        g.lifetime_bookings,
        sum(f.realized_revenue) as lifetime_value,
        count(f.booking_id) filter (
            where f.booking_status not in ('Cancelled', 'Expired')
        ) as realized_bookings
    from {{ ref('dim_guests') }} as g
    left join {{ ref('fct_bookings') }} as f on g.guest_email = f.guest_email
    group by g.guest_email, g.guest_name, g.lifetime_bookings
)

select
    guest_email,
    guest_name,
    lifetime_bookings,
    realized_bookings,
    lifetime_value,
    case
        when realized_bookings >= 3 then 'VIP'
        when realized_bookings = 2 then 'Returning'
        else 'New'
    end as loyalty_tier
from guest_realized
