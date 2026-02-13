# Stripe Integration Setup Guide

## Quick start

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Stripe

1. Create a Stripe account: [Stripe](https://stripe.com)
2. Get API keys in the Dashboard: [API keys](https://dashboard.stripe.com/apikeys)
   - **Secret Key** (starts with `sk_test_` in test mode)
   - **Publishable Key** (starts with `pk_test_`)

3. Add to your **`backend/.env`** file (do not commit secrets):

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Email (optional for now)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=noreply@nextstay.com
SMTP_FROM_NAME=NextStay

# Frontend URL (redirects)
FRONTEND_URL=http://localhost:5173
```

### 3. Configure Stripe Webhook

#### Local development

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Login:
   ```bash
   stripe login
   ```
3. Start webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:8000/api/v1/stripe/webhook
   ```
4. Copy the `webhook signing secret` (starts with `whsec_`)
5. Put it into `backend/.env` as `STRIPE_WEBHOOK_SECRET`

#### Production

1. In the [Stripe Dashboard](https://dashboard.stripe.com/webhooks) create a webhook endpoint:
   - URL: `https://yourdomain.com/api/v1/stripe/webhook`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`
2. Copy the signing secret and add it to `backend/.env`

### When Pending becomes Confirmed

Booking status **Pending → Confirmed** is updated in two cases:

1. **Stripe webhook** — Stripe sends `checkout.session.completed` to your backend webhook URL. In production or with local `stripe listen`, it updates right after payment.

2. **Success page fallback** — after payment, the guest lands on `/booking/success?session_id=...` and the frontend calls `GET /api/v1/stripe/confirm-and-get-booking?session_id=...`. The backend verifies the Stripe session and, if paid, switches the booking to **Confirmed** and returns the guest token. This helps even when webhooks are not delivered to localhost.

### 4. Email (Gmail) — optional

1. Enable [2-Step Verification](https://myaccount.google.com/security)
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. Use the App Password as `SMTP_PASSWORD` (not your normal password)

- **SendGrid**: Free tier (100 emails/day)
- **Mailgun**: Free tier (5,000 emails/month)
- **AWS SES**: Pay-as-you-go

### 5. Database migration

You need to add new columns to `bookings`:

```sql
-- Add new columns
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS amount_paid FLOAT;

-- Create an index for faster lookup by session_id
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);

-- Update existing rows (optional)
UPDATE bookings SET status = 'Pending' WHERE status = 'Upcoming';
```

Or use Alembic (recommended for larger projects):

```bash
cd backend
alembic revision --autogenerate -m "Add Stripe fields to bookings"
alembic upgrade head
```

## Testing

### 1. Stripe test cards

Use test cards from [Stripe Docs](https://stripe.com/docs/testing):

- **Successful payment**: `4242 4242 4242 4242`
- **Declined card**: `4000 0000 0000 0002`
- **Requires 3D Secure**: `4000 0025 0000 3155`

**Any future expiration date, any CVC, any ZIP**

### 2. Test flow

1. Start backend: `uvicorn app.main:app --reload`
2. Start frontend: `npm run dev`
3. Open `/book`
4. Select dates and a room
5. Fill the form
6. Click “Confirm booking”
7. In Stripe Checkout use a test card
8. After payment, verify:
   - Booking status is `"Confirmed"` in the admin UI
   - Webhook logs in Stripe Dashboard (if using webhooks)
   - Success page shows the guest link (no email required)

### 3. Webhook verification

```bash
# In another terminal run Stripe CLI
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook

# Or check logs in Stripe Dashboard
```

## Troubleshooting

### Webhook not working

1. Check `STRIPE_WEBHOOK_SECRET` in `backend/.env`
2. Ensure the webhook endpoint is publicly reachable (production)
3. Check backend logs
4. Use Stripe CLI for local development

### Email not sending

1. Check SMTP settings in `backend/.env`
2. For Gmail use an App Password (not your normal password)
3. Check backend logs
4. The email service may log to console if SMTP is not configured

### Stripe Checkout not opening

1. Check `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`
2. Ensure `FRONTEND_URL` is correct
3. Check browser console for errors
4. Check the Network tab in DevTools

## Environment variables checklist

```env
# Required
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173

# Optional (email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=noreply@nextstay.com
SMTP_FROM_NAME=NextStay
```

## Next steps

After configuring Stripe:

1. Test the full booking flow
2. (Optional) test email notifications
3. Configure production webhooks
4. Improve payment error handling
5. Implement refunds if needed

## Useful links

- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
