BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_access_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS guest_access_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_guest_access_token_hash
  ON bookings (guest_access_token_hash) WHERE guest_access_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_created_by_user_id ON bookings (created_by_user_id);

ALTER TABLE booking_passengers
  ADD COLUMN IF NOT EXISTS passenger_number INTEGER,
  ADD COLUMN IF NOT EXISTS identity_country VARCHAR(3),
  ADD COLUMN IF NOT EXISTS identity_number_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS identity_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS identity_number_last4 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS guardian_passenger_id UUID REFERENCES booking_passengers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Guest uploads are owned through their payment/booking access token, not a user row.
ALTER TABLE bank_payment_slips ALTER COLUMN uploaded_by_user_id DROP NOT NULL;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at, id) AS number
  FROM booking_passengers
)
UPDATE booking_passengers passenger
SET passenger_number = numbered.number
FROM numbered
WHERE passenger.id = numbered.id AND passenger.passenger_number IS NULL;

ALTER TABLE booking_passengers ALTER COLUMN passenger_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_passengers_number
  ON booking_passengers (booking_id, passenger_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_passengers_identity_hash
  ON booking_passengers (booking_id, identity_number_hash)
  WHERE identity_number_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_passengers_guardian
  ON booking_passengers (guardian_passenger_id);

COMMIT;
