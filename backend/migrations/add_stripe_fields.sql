-- Migration: Add Stripe fields to bookings table
-- Run this SQL script to update your database schema

-- Add new columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS amount_paid FLOAT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);

-- Update existing bookings status (optional)
-- UPDATE bookings SET status = 'Pending' WHERE status = 'Upcoming';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('guest_email', 'stripe_session_id', 'stripe_payment_intent_id', 'amount_paid');
