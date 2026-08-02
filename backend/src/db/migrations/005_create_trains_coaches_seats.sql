-- 005: Trains, coaches, and seats

CREATE TABLE trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    train_number VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150),

    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    train_id UUID NOT NULL
        REFERENCES trains(id)
        ON DELETE CASCADE,

    coach_number VARCHAR(20) NOT NULL,

    coach_class coach_class NOT NULL,
    reservation_type coach_reservation_type NOT NULL,

    position_number INTEGER NOT NULL,
    total_seats INTEGER NOT NULL DEFAULT 0,

    seat_layout JSONB,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT coaches_position_positive
        CHECK (position_number > 0),

    CONSTRAINT coaches_total_seats_nonnegative
        CHECK (total_seats >= 0),

    CONSTRAINT uq_train_coach_number
        UNIQUE (train_id, coach_number),

    CONSTRAINT uq_train_coach_position
        UNIQUE (train_id, position_number)
);

CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    coach_id UUID NOT NULL
        REFERENCES coaches(id)
        ON DELETE CASCADE,

    seat_number VARCHAR(20) NOT NULL,

    row_number INTEGER,
    column_number INTEGER,

    seat_type VARCHAR(50),
    is_window BOOLEAN NOT NULL DEFAULT FALSE,
    is_aisle BOOLEAN NOT NULL DEFAULT FALSE,
    is_accessible BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT seats_row_positive
        CHECK (row_number IS NULL OR row_number > 0),

    CONSTRAINT seats_column_positive
        CHECK (column_number IS NULL OR column_number > 0),

    CONSTRAINT uq_coach_seat_number
        UNIQUE (coach_id, seat_number)
);

CREATE INDEX idx_seats_coach ON seats(coach_id);
CREATE INDEX idx_seats_active ON seats(coach_id, is_active);
