'use strict';
const { randomUUID } = require('node:crypto');
const EVENTS = require('../../realtime/socket-events.constants');
const { segmentsOverlap } = require('../../realtime/socket-rooms');
class SeatMapPublisher {
  constructor({ io, roomRegistry, seatMapService, logger }) {
    Object.assign(this, { io, roomRegistry, seatMapService, logger });
  }
  async publish(event, input, segmentSpecific = true) {
    if (!this.io || !input?.journeyId) return null;
    const version = await this.seatMapService.incrementVersion(input.journeyId);
    const payload = {
      eventId: randomUUID(),
      version,
      ...input,
      occurredAt: new Date().toISOString(),
    };
    const rooms = (await this.#roomsForJourney(input.journeyId)).filter(
      (room) =>
        !segmentSpecific || segmentsOverlap(room, input.occupiedSegment || input.releasedSegment)
    );
    for (const room of rooms) this.io.to(room.roomName).emit(event, payload);
    this.logger?.debug(
      { event, journeyId: input.journeyId, version, rooms: rooms.length },
      'Seat-map event published'
    );
    return payload;
  }
  async #roomsForJourney(journeyId) {
    const rooms = new Map(
      this.roomRegistry.forJourney(journeyId).map((room) => [room.roomName, room])
    );
    const sockets = await this.io.in(`seatmap-journey:${journeyId}`).fetchSockets();
    for (const socket of sockets)
      for (const room of socket.data.seatMapSubscriptions || [])
        if (room.journeyId === journeyId) rooms.set(room.roomName, room);
    return [...rooms.values()];
  }
  publishSeatHeld(input) {
    return this.publish(
      input.seats?.length > 1 ? EVENTS.SEATS_HELD : EVENTS.SEAT_HELD,
      this.#normalizeSeats(input, 'HELD')
    );
  }
  publishSeatConfirmed(input) {
    return this.publish(
      input.seats?.length > 1 ? EVENTS.SEATS_CONFIRMED : EVENTS.SEAT_CONFIRMED,
      this.#normalizeSeats(input, 'CONFIRMED')
    );
  }
  publishSeatReleased(input) {
    return this.publish(
      input.seats?.length > 1 ? EVENTS.SEATS_RELEASED : EVENTS.SEAT_RELEASED,
      this.#normalizeSeats(input, 'AVAILABLE')
    );
  }
  publishSeatExpired(input) {
    return this.publish(EVENTS.SEAT_EXPIRED, input);
  }
  publishSeatBlocked(input) {
    return this.publish(EVENTS.SEAT_BLOCKED, input, false);
  }
  publishSeatUnblocked(input) {
    return this.publish(EVENTS.SEAT_UNBLOCKED, input, false);
  }
  publishSeatMaintenance(input) {
    return this.publish(EVENTS.SEAT_MAINTENANCE, input, false);
  }
  publishWaitlistOffer(input) {
    return this.publish(EVENTS.WAITLIST_OFFERED, input);
  }
  publishCoachAvailabilityChanged(input) {
    return this.publish(
      input.isAvailable ? EVENTS.COACH_ENABLED : EVENTS.COACH_DISABLED,
      input,
      false
    );
  }
  publishJourneyBookingClosed(input) {
    return this.publish(EVENTS.BOOKING_CLOSED, input, false);
  }
  publishJourneyCancelled(input) {
    return this.publish(EVENTS.JOURNEY_CANCELLED, input, false);
  }
  publishJourneyDelayed(input) {
    return this.publish(EVENTS.JOURNEY_DELAYED, input, false);
  }
  publishSeatMapRefresh(input) {
    return this.publish(EVENTS.VERSION, input, false);
  }
  #normalizeSeats(input, status) {
    if (input.seats?.length !== 1) return input;
    const seat = input.seats[0];
    return {
      ...input,
      seats: undefined,
      seat,
      state: {
        status,
        selectable: status === 'AVAILABLE',
        holdExpiresAt: seat.holdExpiresAt || null,
      },
    };
  }
}
module.exports = SeatMapPublisher;
