-- 004: Railway network — stations, routes, route_stations

CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    local_name VARCHAR(150),

    city VARCHAR(100),
    district VARCHAR(100),

    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),

    platform_count INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT stations_platform_count_positive
        CHECK (platform_count IS NULL OR platform_count >= 0),

    CONSTRAINT stations_latitude_valid
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),

    CONSTRAINT stations_longitude_valid
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    start_station_id UUID NOT NULL REFERENCES stations(id),
    end_station_id UUID NOT NULL REFERENCES stations(id),

    total_distance_km NUMERIC(8,2),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT routes_different_endpoints
        CHECK (start_station_id <> end_station_id),

    CONSTRAINT routes_distance_positive
        CHECK (total_distance_km IS NULL OR total_distance_km > 0)
);

CREATE TABLE route_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    route_id UUID NOT NULL
        REFERENCES routes(id)
        ON DELETE CASCADE,

    station_id UUID NOT NULL
        REFERENCES stations(id),

    sequence_number INTEGER NOT NULL,

    distance_from_start_km NUMERIC(8,2) NOT NULL,

    default_arrival_offset_minutes INTEGER,
    default_departure_offset_minutes INTEGER,

    stop_duration_minutes INTEGER NOT NULL DEFAULT 0,

    can_board BOOLEAN NOT NULL DEFAULT TRUE,
    can_alight BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT route_stations_sequence_nonnegative
        CHECK (sequence_number >= 0),

    CONSTRAINT route_stations_distance_nonnegative
        CHECK (distance_from_start_km >= 0),

    CONSTRAINT route_stations_stop_duration_nonnegative
        CHECK (stop_duration_minutes >= 0),

    CONSTRAINT uq_route_station
        UNIQUE (route_id, station_id),

    CONSTRAINT uq_route_sequence
        UNIQUE (route_id, sequence_number)
);

CREATE INDEX idx_route_stations_route_sequence
    ON route_stations(route_id, sequence_number);

CREATE INDEX idx_route_stations_station ON route_stations(station_id);
