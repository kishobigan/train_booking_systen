-- 008: Bookings

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_reference VARCHAR(30) NOT NULL UNIQUE,

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    journey_id UUID NOT NULL REFERENCES journeys(id),

    origin_journey_station_id UUID NOT NULL
        REFERENCES journey_stations(id),

    destination_journey_station_id UUID NOT NULL
        REFERENCES journey_stations(id),

    origin_sequence INTEGER NOT NULL,
    destination_sequence INTEGER NOT NULL,

    contact_name VARCHAR(150) NOT NULL,
    contact_email CITEXT,
    contact_phone VARCHAR(30),

    passenger_count INTEGER NOT NULL,

    subtotal NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    service_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,

    currency CHAR(3) NOT NULL DEFAULT 'LKR',

    status booking_status NOT NULL DEFAULT 'PENDING',

    hold_expires_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT bookings_segment_valid
        CHECK (origin_sequence < destination_sequence),

    CONSTRAINT bookings_passenger_count_positive
        CHECK (passenger_count > 0),

    CONSTRAINT bookings_amounts_nonnegative
        CHECK (
            subtotal >= 0
            AND discount_amount >= 0
            AND service_fee >= 0
            AND tax_amount >= 0
            AND total_amount >= 0
        ),

    CONSTRAINT bookings_contact_required
        CHECK (contact_email IS NOT NULL OR contact_phone IS NOT NULL),

    CONSTRAINT bookings_hold_expiry_required
        CHECK (status <> 'HELD' OR hold_expires_at IS NOT NULL)
);

CREATE INDEX idx_bookings_user ON bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_journey ON bookings(journey_id, status);
CREATE INDEX idx_bookings_reference ON bookings(booking_reference);
CREATE INDEX idx_bookings_hold_expiry ON bookings(hold_expires_at)
    WHERE status = 'HELD';
CREATE INDEX idx_bookings_created ON bookings(created_at DESC);
