-- 007: Fare management

CREATE TABLE fare_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    route_id UUID REFERENCES routes(id),

    name VARCHAR(150) NOT NULL,

    base_fare NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_per_km NUMERIC(10,4) NOT NULL,
    minimum_fare NUMERIC(10,2) NOT NULL DEFAULT 0,

    currency CHAR(3) NOT NULL DEFAULT 'LKR',

    valid_from DATE NOT NULL,
    valid_until DATE,

    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fare_rules_base_nonnegative
        CHECK (base_fare >= 0),

    CONSTRAINT fare_rules_price_positive
        CHECK (price_per_km >= 0),

    CONSTRAINT fare_rules_minimum_nonnegative
        CHECK (minimum_fare >= 0),

    CONSTRAINT fare_rules_valid_period
        CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE fare_rule_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    fare_rule_id UUID NOT NULL
        REFERENCES fare_rules(id)
        ON DELETE CASCADE,

    coach_class coach_class NOT NULL,

    base_fare_override NUMERIC(10,2),
    price_per_km_override NUMERIC(10,4),
    minimum_fare_override NUMERIC(10,2),

    multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.000,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fare_rule_classes_multiplier_positive
        CHECK (multiplier > 0),

    CONSTRAINT uq_fare_rule_class
        UNIQUE (fare_rule_id, coach_class)
);

CREATE TABLE passenger_fare_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    passenger_type passenger_type NOT NULL UNIQUE,

    discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT passenger_fare_discount_valid
        CHECK (discount_percentage BETWEEN 0 AND 100)
);
