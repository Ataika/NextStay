select
    guest_email,
    min(guest_name) as guest_name,
    count(*) as lifetime_bookings,
    min(created_date) as first_booking_date
from {{ ref('stg_bookings') }}
where guest_email is not null
group by guest_email
