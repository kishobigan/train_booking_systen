-- 020: Card, bank-slip, refund, idempotency and reconciliation infrastructure
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'BANK_SLIP';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'AWAITING_VERIFICATION';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'PENDING_MANUAL_PROCESSING';

CREATE TABLE bank_payment_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  original_file_name VARCHAR(255), stored_file_name VARCHAR(255),
  storage_provider VARCHAR(50) NOT NULL, storage_key TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL, file_size_bytes BIGINT NOT NULL,
  file_hash VARCHAR(128) NOT NULL,
  bank_transaction_reference VARCHAR(150), transfer_date DATE,
  depositor_name VARCHAR(150), submitted_amount NUMERIC(12,2),
  status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED', uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by_user_id UUID REFERENCES users(id), verified_at TIMESTAMPTZ,
  rejected_by_user_id UUID REFERENCES users(id), rejected_at TIMESTAMPTZ,
  verification_note TEXT, rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bank_payment_slips_status CHECK (status IN ('UPLOADED','UNDER_REVIEW','APPROVED','REJECTED','SUPERSEDED')),
  CONSTRAINT bank_payment_slips_nonempty CHECK (file_size_bytes > 0)
);
CREATE INDEX idx_bank_slips_payment ON bank_payment_slips(payment_id, created_at DESC);
CREATE UNIQUE INDEX uq_active_bank_slip_hash ON bank_payment_slips(file_hash) WHERE status <> 'SUPERSEDED';

ALTER TABLE refunds ADD COLUMN manual_refund_reference VARCHAR(150);
ALTER TABLE refunds ADD COLUMN processed_by_user_id UUID REFERENCES users(id);
ALTER TABLE refunds ADD COLUMN manual_refund_note TEXT;
ALTER TABLE refunds ADD COLUMN provider_response JSONB;
ALTER TABLE refunds ADD COLUMN failure_code VARCHAR(100);
ALTER TABLE refunds ADD COLUMN failure_message TEXT;

CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(100) NOT NULL, idempotency_key VARCHAR(200) NOT NULL,
  request_hash VARCHAR(64) NOT NULL, resource_type VARCHAR(100), resource_id UUID,
  response_status INTEGER, response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(scope, idempotency_key)
);
CREATE INDEX idx_idempotency_expiry ON idempotency_records(expires_at);

CREATE TABLE payment_reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_id UUID REFERENCES payments(id),
  refund_id UUID REFERENCES refunds(id), provider_name VARCHAR(100),
  internal_status_before VARCHAR(50), provider_status VARCHAR(50), internal_status_after VARCHAR(50),
  result VARCHAR(50) NOT NULL, difference_type VARCHAR(100), details JSONB,
  reconciled_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reconciliation_payment ON payment_reconciliation_logs(payment_id, created_at DESC);
