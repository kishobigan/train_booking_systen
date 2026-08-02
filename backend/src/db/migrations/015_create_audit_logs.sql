-- 015: Administration, audit, and journey disruptions

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,

    old_values JSONB,
    new_values JSONB,

    ip_address INET,
    user_agent TEXT,
    request_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE journey_disruptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    journey_id UUID NOT NULL
        REFERENCES journeys(id)
        ON DELETE CASCADE,

    disruption_type VARCHAR(50) NOT NULL,

    title VARCHAR(200) NOT NULL,
    description TEXT,

    affected_from_sequence INTEGER,
    affected_to_sequence INTEGER,

    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disruption_segment_valid
        CHECK (
            affected_from_sequence IS NULL
            OR affected_to_sequence IS NULL
            OR affected_from_sequence < affected_to_sequence
        )
);
