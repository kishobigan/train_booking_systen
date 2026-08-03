-- 025: Train-based administration scope
CREATE TABLE admin_train_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  train_id UUID NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  assigned_by_user_id UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES users(id),
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_active_admin_train_assignment
  ON admin_train_assignments(admin_user_id, train_id) WHERE is_active = TRUE;
CREATE INDEX idx_admin_train_assignments_admin_active
  ON admin_train_assignments(admin_user_id, is_active);
CREATE INDEX idx_admin_train_assignments_train_active
  ON admin_train_assignments(train_id, is_active);
CREATE INDEX idx_journeys_train_scope ON journeys(train_id);

