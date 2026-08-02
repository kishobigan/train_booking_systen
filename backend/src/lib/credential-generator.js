'use strict';
const { randomBytes } = require('node:crypto');
function generateTemporaryPassword(length = 20) {
  const groups = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz',
    '0123456789',
    '!@#$%^&*_-+=',
  ];
  const required = groups.map((group) => group[randomBytes(1)[0] % group.length]);
  const all = groups.join('');
  while (required.length < length) required.push(all[randomBytes(1)[0] % all.length]);
  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = randomBytes(2).readUInt16BE() % (i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }
  return required.join('');
}
module.exports = { generateTemporaryPassword };
