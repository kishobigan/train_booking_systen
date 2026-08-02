-- 009: Booking passengers

CREATE TABLE booking_passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_id UUID NOT NULL
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    full_name VARCHAR(150) NOT NULL,
    passenger_type passenger_type NOT NULL DEFAULT 'ADULT',

    identity_type VARCHAR(30),
    identity_number VARCHAR(100),

    date_of_birth DATE,

    assigned_seat_id UUID REFERENCES seats(id),

    fare_before_discount NUMERIC(10,2) NOT NULL,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    final_fare NUMERIC(10,2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT booking_passenger_fares_nonnegative
        CHECK (
            fare_before_discount >= 0
            AND discount_amount >= 0
            AND final_fare >= 0
        )
);

CREATE INDEX idx_booking_passengers_booking ON booking_passengers(booking_id);
