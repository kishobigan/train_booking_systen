-- 011: Active seat allocations with exclusion constraint

CREATE TABLE active_seat_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_seat_id UUID NOT NULL UNIQUE
        REFERENCES booking_seats(id)
        ON DELETE CASCADE,

    journey_id UUID NOT NULL
        REFERENCES journeys(id)
        ON DELETE CASCADE,

    seat_id UUID NOT NULL
        REFERENCES seats(id),

    occupied_segment INT4RANGE NOT NULL,

    allocation_type booking_status NOT NULL,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT active_allocations_valid_type
        CHECK (allocation_type IN ('HELD', 'CONFIRMED')),

    CONSTRAINT active_allocations_hold_expiry
        CHECK (
            allocation_type <> 'HELD'
            OR expires_at IS NOT NULL
        )
);

ALTER TABLE active_seat_allocations
    ADD CONSTRAINT prevent_overlapping_seat_allocations
    EXCLUDE USING gist (
        journey_id WITH =,
        seat_id WITH =,
        occupied_segment WITH &&
    );

CREATE INDEX idx_active_allocations_booking_seat
    ON active_seat_allocations(booking_seat_id);

CREATE INDEX idx_active_allocations_expiry
    ON active_seat_allocations(expires_at)
    WHERE allocation_type = 'HELD';
