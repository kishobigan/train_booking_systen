'use strict';
const { createClient } = require('redis');
async function createRedisClients(url) {
  if (!url) throw new Error('REDIS_URL is required when WebSocket Redis is enabled');
  const publisher = createClient({ url });
  const subscriber = publisher.duplicate();
  await Promise.all([publisher.connect(), subscriber.connect()]);
  return {
    publisher,
    subscriber,
    close: () => Promise.allSettled([publisher.quit(), subscriber.quit()]),
  };
}
module.exports = { createRedisClients };
