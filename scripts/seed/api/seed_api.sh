#!/bin/bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000/api/v1}"

echo "Using API: $API_BASE_URL"

create_room() {
  local number="$1"
  local category="$2"
  local status="$3"
  local price="$4"
  local capacity="$5"
  curl -s -X POST "$API_BASE_URL/rooms" \
    -H "Content-Type: application/json" \
    -d "{\"number\":\"$number\",\"category\":\"$category\",\"status\":\"$status\",\"price\":$price,\"capacity\":$capacity}"
}

create_booking() {
  local guest_name="$1"
  local guest_email="$2"
  local room_id="$3"
  local room_number="$4"
  local check_in="$5"
  local check_out="$6"
  local notes="$7"
  curl -s -X POST "$API_BASE_URL/bookings" \
    -H "Content-Type: application/json" \
    -d "{\"guestName\":\"$guest_name\",\"email\":\"$guest_email\",\"roomId\":$room_id,\"roomNumber\":\"$room_number\",\"checkIn\":\"$check_in\",\"checkOut\":\"$check_out\",\"status\":\"Pending\",\"notes\":\"$notes\"}"
}

echo "Creating rooms..."
create_room "501" "Standard" "Available" 88 2 >/dev/null
create_room "502" "Standard" "Available" 92 2 >/dev/null
create_room "601" "Deluxe" "Available" 145 3 >/dev/null

echo "Creating bookings..."
create_booking "Seed User A" "a@example.com" 1 "501" "2026-03-10T14:00:00Z" "2026-03-13T12:00:00Z" "API seed A" >/dev/null
create_booking "Seed User B" "b@example.com" 2 "502" "2026-03-20T14:00:00Z" "2026-03-22T12:00:00Z" "API seed B" >/dev/null

echo "DONE"
