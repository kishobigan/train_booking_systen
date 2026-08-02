-- 010: Booking seats (segment occupancy history)

CREATE TABLE booking_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_id UUID NOT NULL
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    booking_passenger_id UUID
        REFERENCES booking_passengers(id)
        ON DELETE SET NULL,

    journey_id UUID NOT NULL
        REFERENCES journeys(id)
        ON DELETE CASCADE,

    journey_seat_id UUID NOT NULL
        REFERENCES journey_seats(id),

    seat_id UUID NOT NULL
        REFERENCES seats(id),

    origin_sequence INTEGER NOT NULL,
    destination_sequence INTEGER NOT NULL,

    occupied_segment INT4RANGE GENERATED ALWAYS AS (
        int4range(origin_sequence, destination_sequence, '[)')
    ) STORED,

    status booking_status NOT NULL,

    hold_expires_at TIMESTAMPTZ,

    seat_number_snapshot VARCHAR(20) NOT NULL,
    coach_number_snapshot VARCHAR(20) NOT NULL,
    coach_class_snapshot coach_class NOT NULL,

    fare_amount NUMERIC(10,2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT booking_seats_segment_valid
        CHECK (origin_sequence < destination_sequence),

    CONSTRAINT booking_seats_fare_nonnegative
        CHECK (fare_amount >= 0),

    CONSTRAINT booking_seats_hold_expiry_required
        CHECK (status <> 'HELD' OR hold_expires_at IS NOT NULL)
);
