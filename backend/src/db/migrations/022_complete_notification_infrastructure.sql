-- 022: Durable notification queue, retries, deduplication and preferences
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'RETRYING';
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE notifications
  ADD COLUMN journey_id UUID REFERENCES journeys(id) ON DELETE SET NULL,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN next_retry_at TIMESTAMPTZ,
  ADD COLUMN last_attempt_at TIMESTAMPTZ,
  ADD COLUMN provider_name VARCHAR(100),
  ADD COLUMN failure_code VARCHAR(100),
  ADD COLUMN deduplication_key VARCHAR(255),
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX uq_notification_deduplication
  ON notifications(deduplication_key) WHERE deduplication_key IS NOT NULL;
CREATE INDEX idx_notifications_due
  ON notifications(status, next_retry_at, scheduled_at);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_journey_created ON notifications(journey_id, created_at DESC);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  booking_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payment_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  waitlist_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  journey_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
