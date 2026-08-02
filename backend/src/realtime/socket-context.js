'use strict';
class SocketContext {
  constructor() {
    this.rooms = new Map();
  }
  add(room) {
    const current = this.rooms.get(room.roomName) || { ...room, subscriberCount: 0 };
    current.subscriberCount += 1;
    this.rooms.set(room.roomName, current);
    return current;
  }
  remove(roomName) {
    const current = this.rooms.get(roomName);
    if (!current) return;
    current.subscriberCount -= 1;
    if (current.subscriberCount <= 0) this.rooms.delete(roomName);
  }
  forJourney(journeyId) {
    return [...this.rooms.values()].filter((room) => room.journeyId === journeyId);
  }
}
module.exports = SocketContext;
