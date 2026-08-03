-- 026: Add revocation history to the existing Staff-to-Station assignment table.
ALTER TABLE staff_stations
  ADD COLUMN revoked_at TIMESTAMPTZ,
  ADD COLUMN revoked_by_user_id UUID REFERENCES users(id),
  ADD COLUMN revocation_reason TEXT,
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE staff_stations DROP CONSTRAINT IF EXISTS staff_stations_staff_user_id_station_id_key;
CREATE UNIQUE INDEX uq_active_staff_station_assignment
  ON staff_stations(staff_user_id, station_id) WHERE is_active = TRUE;
CREATE INDEX idx_staff_station_assignments_staff_active ON staff_stations(staff_user_id, is_active);
CREATE INDEX idx_staff_station_assignments_station_active ON staff_stations(station_id, is_active);

