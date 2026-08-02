CREATE TABLE IF NOT EXISTS job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), job_name VARCHAR(100) NOT NULL,
  worker_id VARCHAR(150), status VARCHAR(30) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), finished_at TIMESTAMPTZ,
  records_found INTEGER NOT NULL DEFAULT 0, records_processed INTEGER NOT NULL DEFAULT 0,
  records_succeeded INTEGER NOT NULL DEFAULT 0, records_failed INTEGER NOT NULL DEFAULT 0,
  error_code VARCHAR(100), error_message TEXT, metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_executions_status_check CHECK (status IN ('STARTED','COMPLETED','COMPLETED_WITH_ERRORS','FAILED','SKIPPED_LOCKED'))
);
CREATE INDEX IF NOT EXISTS job_executions_name_started_idx ON job_executions(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS job_executions_status_idx ON job_executions(status);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS processing_worker_id VARCHAR(150);
CREATE INDEX IF NOT EXISTS notifications_processing_lease_idx ON notifications(status, last_attempt_at) WHERE status = 'PROCESSING';
