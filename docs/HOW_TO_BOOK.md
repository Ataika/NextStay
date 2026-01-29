# Booking Flow (How guests book a room)

## High-level steps

1. **Search available rooms**
   - Guest opens `/book`
   - Chooses check-in / check-out
   - Clicks “Search rooms”
   - Backend returns rooms available for the date range

2. **Select a room**
   - Guest sees price per night + total price + nights + capacity
   - Clicks “Book now”

3. **Create a booking**
   - Guest fills name + email
   - Backend creates a booking with status **`Pending`** and creates a **guest token**

4. **Pay with Stripe**
   - Backend creates a Stripe Checkout Session
   - Guest pays on Stripe
   - After payment the booking becomes **`Confirmed`**

## API endpoints used

- `GET /api/v1/rooms/available`
- `POST /api/v1/bookings`
- `POST /api/v1/stripe/create-checkout-session`
- `POST /api/v1/stripe/webhook` (webhook, optional for localhost)
- `GET /api/v1/stripe/confirm-and-get-booking?session_id=...` (success-page fallback)

## Where the guest gets the “booking code” and access link

After successful payment, the user is redirected to:

`/booking/success?session_id=...`

This page displays:
- Booking code (booking id)
- Booking dates + room number
- Guest access link (`/guest/{token}`) with “Copy” button

## Testing (local)

1. Start backend + frontend (see `QUICK_START.md`)
2. Open `http://localhost:5173/book`
3. Complete a booking and pay with Stripe test card `4242 4242 4242 4242`
4. Confirm:
   - Success page shows booking code + guest link
   - Admin “Bookings” page shows status **Confirmed**

## Notes

- Room must be `Available` to appear in search
- If Stripe webhooks are not available locally, the success page confirmation endpoint will still switch `Pending → Confirmed`
