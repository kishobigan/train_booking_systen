-- 021: Durable waitlist concurrency and unified seat allocations
ALTER TABLE waitlist_entries
  ADD COLUMN offer_attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX uq_active_waitlist_request
  ON waitlist_entries(user_id, journey_id, origin_sequence, destination_sequence, requested_coach_class)
  WHERE status IN ('WAITING', 'OFFERED');
CREATE INDEX idx_waitlist_user_active ON waitlist_entries(user_id, status);
CREATE INDEX idx_waitlist_offer_expiry ON waitlist_entries(offer_expires_at)
  WHERE status = 'OFFERED';

ALTER TABLE active_seat_allocations ALTER COLUMN booking_seat_id DROP NOT NULL;
ALTER TABLE active_seat_allocations
  ADD COLUMN waitlist_entry_id UUID REFERENCES waitlist_entries(id) ON DELETE CASCADE,
  ADD COLUMN journey_seat_id UUID REFERENCES journey_seats(id);
ALTER TABLE active_seat_allocations
  ADD CONSTRAINT active_allocation_exactly_one_source CHECK (
    (booking_seat_id IS NOT NULL AND waitlist_entry_id IS NULL)
    OR (booking_seat_id IS NULL AND waitlist_entry_id IS NOT NULL)
  );
CREATE UNIQUE INDEX uq_waitlist_offered_journey_seat
  ON active_seat_allocations(waitlist_entry_id, journey_seat_id)
  WHERE waitlist_entry_id IS NOT NULL;
CREATE INDEX idx_active_allocations_waitlist
  ON active_seat_allocations(waitlist_entry_id)
  WHERE waitlist_entry_id IS NOT NULL;
