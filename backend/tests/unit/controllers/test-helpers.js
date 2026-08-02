'use strict';
const UUID = '11111111-1111-4111-8111-111111111111';
function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send() {
      return this;
    },
  };
}
async function invoke(handler, req, res) {
  let error;
  await handler(req, res, (value) => {
    error = value;
  });
  if (error) throw error;
}
module.exports = { UUID, response, invoke };
