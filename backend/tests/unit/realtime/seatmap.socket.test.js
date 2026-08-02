'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const SeatMapSocket = require('../../../src/modules/seatmap/seatmap.socket');
const SocketContext = require('../../../src/realtime/socket-context');
function socket() {
  return {
    data: { rateLimit: { startedAt: Date.now(), count: 0, max: 20 } },
    joined: [],
    left: [],
    emitted: [],
    on() {},
    async join(room) {
      this.joined.push(room);
    },
    async leave(room) {
      this.left.push(room);
    },
    emit(name, value) {
      this.emitted.push({ name, value });
    },
  };
}
test('socket subscribes, pings, resyncs and cleans its room', async () => {
  const roomRegistry = new SocketContext();
  const handler = new SeatMapSocket({
    roomRegistry,
    config: { maxSubscriptions: 5 },
    seatMapService: {
      getSeatMapSnapshot: async () => ({
        journeyId: 'j1',
        segment: { originSequence: 0, destinationSequence: 3 },
        version: '1',
      }),
    },
  });
  const client = socket();
  handler.register(client);
  let subscribed;
  await handler.handleSubscribe(client, {}, (value) => {
    subscribed = value;
  });
  assert.equal(subscribed.room, 'seatmap:j1:0:3');
  assert.equal(roomRegistry.forJourney('j1').length, 1);
  let pong;
  handler.handlePing(client, { nonce: 'n' }, (value) => {
    pong = value;
  });
  assert.equal(pong.echo, 'n');
  await handler.handleResync(client, {}, () => {});
  assert(client.emitted.some((item) => item.name === 'seatmap:snapshot'));
  handler.handleDisconnect(client);
  assert.equal(roomRegistry.forJourney('j1').length, 0);
});
