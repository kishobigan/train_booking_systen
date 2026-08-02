'use strict';
const EVENTS = require('../../realtime/socket-events.constants');
const { buildSeatMapRoom } = require('../../realtime/socket-rooms');
const socketError = require('../../realtime/socket-error-handler');
class SeatMapSocket {
  constructor({ seatMapService, roomRegistry, config, logger }) {
    Object.assign(this, { seatMapService, roomRegistry, config, logger });
  }
  register(socket) {
    socket.data.seatMapRooms ||= new Map();
    socket.data.seatMapSubscriptions ||= [];
    socket.on(EVENTS.SUBSCRIBE, (payload, ack) => this.handleSubscribe(socket, payload, ack));
    socket.on(EVENTS.UNSUBSCRIBE, (payload, ack) => this.handleUnsubscribe(socket, payload, ack));
    socket.on(EVENTS.RESYNC, (payload, ack) => this.handleResync(socket, payload, ack));
    socket.on(EVENTS.PING, (payload, ack) => this.handlePing(socket, payload, ack));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }
  async handleSubscribe(socket, payload, ack = () => {}) {
    try {
      this.#consume(socket);
      if (socket.data.seatMapRooms.size >= this.config.maxSubscriptions) {
        const error = new Error('Subscription limit reached');
        error.code = 'SEATMAP_SUBSCRIPTION_LIMIT';
        throw error;
      }
      const snapshot = await this.seatMapService.getSeatMapSnapshot(payload);
      const room = {
        roomName: buildSeatMapRoom({ journeyId: snapshot.journeyId, ...snapshot.segment }),
        journeyId: snapshot.journeyId,
        originSequence: snapshot.segment.originSequence,
        destinationSequence: snapshot.segment.destinationSequence,
      };
      if (socket.data.seatMapRooms.has(room.roomName)) {
        const existing = {
          success: true,
          room: room.roomName,
          journeyId: room.journeyId,
          originSequence: room.originSequence,
          destinationSequence: room.destinationSequence,
          version: snapshot.version,
        };
        socket.emit(EVENTS.SNAPSHOT, snapshot);
        ack(existing);
        return;
      }
      await socket.join(room.roomName);
      await socket.join(`seatmap-journey:${room.journeyId}`);
      socket.data.seatMapRooms.set(room.roomName, room);
      socket.data.seatMapSubscriptions = [...socket.data.seatMapRooms.values()];
      this.roomRegistry.add(room);
      const result = {
        success: true,
        room: room.roomName,
        journeyId: room.journeyId,
        originSequence: room.originSequence,
        destinationSequence: room.destinationSequence,
        version: snapshot.version,
      };
      socket.emit(EVENTS.SUBSCRIBED, result);
      socket.emit(EVENTS.SNAPSHOT, snapshot);
      ack(result);
    } catch (error) {
      const result = socketError(error, 'INVALID_SEATMAP_SUBSCRIPTION');
      socket.emit(EVENTS.ERROR, result);
      ack(result);
    }
  }
  async handleUnsubscribe(socket, payload = {}, ack = () => {}) {
    try {
      this.#consume(socket);
      const targets = payload.room ? [payload.room] : [...socket.data.seatMapRooms.keys()];
      for (const room of targets)
        if (socket.data.seatMapRooms.has(room)) {
          await socket.leave(room);
          socket.data.seatMapRooms.delete(room);
          this.roomRegistry.remove(room);
        }
      socket.data.seatMapSubscriptions = [...socket.data.seatMapRooms.values()];
      const result = { success: true };
      socket.emit(EVENTS.UNSUBSCRIBED, result);
      ack(result);
    } catch (error) {
      ack(socketError(error));
    }
  }
  async handleResync(socket, payload, ack = () => {}) {
    try {
      this.#consume(socket);
      const snapshot = await this.seatMapService.getSeatMapSnapshot(payload);
      socket.emit(EVENTS.SNAPSHOT, snapshot);
      ack({ success: true, version: snapshot.version });
    } catch (error) {
      const result = socketError(error, 'SEATMAP_RESYNC_REQUIRED');
      socket.emit(EVENTS.ERROR, result);
      ack(result);
    }
  }
  handlePing(socket, payload, ack = () => {}) {
    try {
      this.#consume(socket);
      const result = { success: true, serverTime: new Date().toISOString(), echo: payload?.nonce };
      socket.emit(EVENTS.PONG, result);
      ack(result);
    } catch (error) {
      ack(socketError(error));
    }
  }
  handleDisconnect(socket) {
    for (const room of socket.data.seatMapRooms?.keys() || []) this.roomRegistry.remove(room);
    socket.data.seatMapRooms?.clear();
    socket.data.seatMapSubscriptions = [];
  }
  #consume(socket) {
    const rate = socket.data.rateLimit;
    const now = Date.now();
    if (now - rate.startedAt >= 60000) {
      rate.startedAt = now;
      rate.count = 0;
    }
    rate.count += 1;
    if (rate.count > rate.max) {
      const error = new Error('Socket event rate limit exceeded');
      error.code = 'SOCKET_RATE_LIMIT';
      throw error;
    }
  }
}
module.exports = SeatMapSocket;
