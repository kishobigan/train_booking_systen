-- 019: Hierarchical authentication and authorization
ALTER TABLE users
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN password_changed_at TIMESTAMPTZ,
  ADD COLUMN temporary_password_expires_at TIMESTAMPTZ,
  ADD COLUMN blocked_at TIMESTAMPTZ,
  ADD COLUMN blocked_by_user_id UUID REFERENCES users(id),
  ADD COLUMN blocked_reason TEXT;

CREATE TABLE admin_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  assigned_by_user_id UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (admin_user_id, journey_id)
);

CREATE TABLE staff_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  assigned_by_user_id UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (staff_user_id, station_id)
);

CREATE INDEX idx_admin_journeys_active ON admin_journeys(admin_user_id, journey_id)
  WHERE is_active = TRUE;
CREATE INDEX idx_staff_stations_active ON staff_stations(staff_user_id, station_id)
  WHERE is_active = TRUE;
