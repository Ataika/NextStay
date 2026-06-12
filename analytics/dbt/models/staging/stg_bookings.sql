with source as (
    select * from {{ ref('seed_bookings') }}
)

select
    id as booking_id,
    guest_name,
    room_id,
    room_number,
    status as booking_status,
    amount_paid,
    cast(check_in as date) as check_in_date,
    cast(check_out as date) as check_out_date,
    cast(created_at as date) as created_date,
    lower(guest_email) as guest_email,
    current_timestamp as dbt_loaded_at
from source
