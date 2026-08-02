-- 014: Notifications

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    booking_id UUID
        REFERENCES bookings(id)
        ON DELETE SET NULL,

    channel notification_channel NOT NULL,
    destination VARCHAR(255) NOT NULL,

    template_code VARCHAR(100) NOT NULL,

    subject VARCHAR(255),
    content TEXT NOT NULL,

    status notification_status NOT NULL DEFAULT 'PENDING',

    provider_reference VARCHAR(150),
    failure_message TEXT,

    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_pending
    ON notifications(status, scheduled_at)
    WHERE status = 'PENDING';

CREATE INDEX idx_notifications_booking ON notifications(booking_id);
