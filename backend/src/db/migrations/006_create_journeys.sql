-- 006: Journey scheduling

CREATE TABLE journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    route_id UUID NOT NULL REFERENCES routes(id),
    train_id UUID NOT NULL REFERENCES trains(id),

    service_number VARCHAR(30) NOT NULL,

    journey_date DATE NOT NULL,

    scheduled_departure_at TIMESTAMPTZ NOT NULL,
    scheduled_arrival_at TIMESTAMPTZ,

    actual_departure_at TIMESTAMPTZ,
    actual_arrival_at TIMESTAMPTZ,

    status journey_status NOT NULL DEFAULT 'SCHEDULED',

    booking_opens_at TIMESTAMPTZ,
    booking_closes_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT journeys_arrival_after_departure
        CHECK (
            scheduled_arrival_at IS NULL
            OR scheduled_arrival_at > scheduled_departure_at
        ),

    CONSTRAINT journeys_booking_window_valid
        CHECK (
            booking_opens_at IS NULL
            OR booking_closes_at IS NULL
            OR booking_opens_at < booking_closes_at
        ),

    CONSTRAINT uq_train_departure
        UNIQUE (train_id, scheduled_departure_at)
);

CREATE INDEX idx_journeys_route_date ON journeys(route_id, journey_date);
CREATE INDEX idx_journeys_train_date ON journeys(train_id, journey_date);
CREATE INDEX idx_journeys_status_date ON journeys(status, journey_date);

CREATE TABLE journey_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    journey_id UUID NOT NULL
        REFERENCES journeys(id)
        ON DELETE CASCADE,

    station_id UUID NOT NULL
        REFERENCES stations(id),

    sequence_number INTEGER NOT NULL,

    distance_from_start_km NUMERIC(8,2) NOT NULL,

    scheduled_arrival_at TIMESTAMPTZ,
    scheduled_departure_at TIMESTAMPTZ,

    actual_arrival_at TIMESTAMPTZ,
    actual_departure_at TIMESTAMPTZ,

    platform_number VARCHAR(20),

    can_board BOOLEAN NOT NULL DEFAULT TRUE,
    can_alight BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT journey_stations_sequence_nonnegative
        CHECK (sequence_number >= 0),

    CONSTRAINT journey_stations_distance_nonnegative
        CHECK (distance_from_start_km >= 0),

    CONSTRAINT uq_journey_station
        UNIQUE (journey_id, station_id),

    CONSTRAINT uq_journey_station_sequence
        UNIQUE (journey_id, sequence_number)
);

CREATE INDEX idx_journey_stations_sequence
    ON journey_stations(journey_id, sequence_number);

CREATE INDEX idx_journey_stations_station
    ON journey_stations(station_id, journey_id);

CREATE TABLE journey_coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    journey_id UUID NOT NULL
        REFERENCES journeys(id)
        ON DELETE CASCADE,

    coach_id UUID NOT NULL
        REFERENCES coaches(id),

    coach_number_snapshot VARCHAR(20) NOT NULL,
    coach_class_snapshot coach_class NOT NULL,
    reservation_type_snapshot coach_reservation_type NOT NULL,

    position_number INTEGER NOT NULL,

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_journey_coach
        UNIQUE (journey_id, coach_id),

    CONSTRAINT uq_journey_coach_position
        UNIQUE (journey_id, position_number)
);

CREATE TABLE journey_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    journey_id UUID NOT NULL
        REFERENCES journeys(id)
        ON DELETE CASCADE,

    journey_coach_id UUID NOT NULL
        REFERENCES journey_coaches(id)
        ON DELETE CASCADE,

    seat_id UUID NOT NULL
        REFERENCES seats(id),

    seat_number_snapshot VARCHAR(20) NOT NULL,

    status seat_status NOT NULL DEFAULT 'AVAILABLE',

    blocked_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_journey_seat
        UNIQUE (journey_id, seat_id)
);

CREATE INDEX idx_journey_seats_journey_coach
    ON journey_seats(journey_id, journey_coach_id);

CREATE INDEX idx_journey_seats_status
    ON journey_seats(journey_id, status);
