-- 012: Payments and refunds

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_id UUID NOT NULL REFERENCES bookings(id),

    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    provider_reference VARCHAR(150),

    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDING',

    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'LKR',

    provider_name VARCHAR(100),

    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    failure_code VARCHAR(100),
    failure_message TEXT,

    provider_response JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payments_amount_positive
        CHECK (amount > 0)
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status, created_at);
CREATE INDEX idx_payments_provider_reference ON payments(provider_reference);

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payment_id UUID NOT NULL REFERENCES payments(id),
    booking_id UUID NOT NULL REFERENCES bookings(id),

    refund_reference VARCHAR(100) NOT NULL UNIQUE,
    provider_refund_reference VARCHAR(150),

    amount NUMERIC(12,2) NOT NULL,

    reason TEXT,
    status payment_status NOT NULL DEFAULT 'PROCESSING',

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT refunds_amount_positive
        CHECK (amount > 0)
);

CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider_name VARCHAR(100) NOT NULL,
    provider_event_id VARCHAR(200) NOT NULL,

    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,

    processed_at TIMESTAMPTZ,
    processing_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_provider_event
        UNIQUE (provider_name, provider_event_id)
);

CREATE TABLE booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_id UUID NOT NULL
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    previous_status booking_status,
    new_status booking_status NOT NULL,

    changed_by_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    reason TEXT,
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_status_history_booking
    ON booking_status_history(booking_id, created_at);
