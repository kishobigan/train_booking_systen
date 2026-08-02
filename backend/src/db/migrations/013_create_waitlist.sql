-- 013: Waitlist management

CREATE TABLE waitlist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    journey_id UUID NOT NULL
        REFERENCES journeys(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    origin_journey_station_id UUID NOT NULL
        REFERENCES journey_stations(id),

    destination_journey_station_id UUID NOT NULL
        REFERENCES journey_stations(id),

    origin_sequence INTEGER NOT NULL,
    destination_sequence INTEGER NOT NULL,

    requested_coach_class coach_class NOT NULL,

    passenger_count INTEGER NOT NULL DEFAULT 1,

    status waitlist_status NOT NULL DEFAULT 'WAITING',

    priority_number BIGSERIAL,

    offered_seat_id UUID
        REFERENCES seats(id),

    offer_expires_at TIMESTAMPTZ,

    converted_booking_id UUID UNIQUE
        REFERENCES bookings(id),

    contact_name VARCHAR(150) NOT NULL,
    contact_email CITEXT,
    contact_phone VARCHAR(30),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT waitlist_segment_valid
        CHECK (origin_sequence < destination_sequence),

    CONSTRAINT waitlist_passenger_count_positive
        CHECK (passenger_count > 0),

    CONSTRAINT waitlist_contact_required
        CHECK (contact_email IS NOT NULL OR contact_phone IS NOT NULL)
);

CREATE INDEX idx_waitlist_journey_status_priority
    ON waitlist_entries(journey_id, status, priority_number);

CREATE INDEX idx_waitlist_segment
    ON waitlist_entries(journey_id, origin_sequence, destination_sequence);
