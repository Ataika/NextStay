-- Singular test: occupancy_rate must always be within [0, 1].
-- Passes when this query returns zero rows.
select
    hotel_id,
    date_key,
    occupancy_rate
from {{ ref('mart_occupancy') }}
where occupancy_rate < 0 or occupancy_rate > 1
