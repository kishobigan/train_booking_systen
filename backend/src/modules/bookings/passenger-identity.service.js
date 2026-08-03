'use strict';
const crypto = require('node:crypto');
const ValidationError = require('../../common/errors/ValidationError');
const IDENTITY_TYPE = require('../../common/constants/passenger-identity-type.constants');

class PassengerIdentityService {
  constructor(config) {
    this.config = config;
    this.key = crypto.createHash('sha256').update(config.encryptionKey).digest();
  }
  normalize(type, value) {
    const normalized = String(value || '')
      .toUpperCase()
      .replace(/[\s.-]/g, '');
    if (type === IDENTITY_TYPE.NIC && !/^(?:\d{9}[VX]|\d{12})$/.test(normalized))
      throw new ValidationError('Invalid Sri Lankan NIC');
    if (type === IDENTITY_TYPE.PASSPORT && !/^[A-Z0-9]{6,20}$/.test(normalized))
      throw new ValidationError('Invalid passport number');
    return normalized;
  }
  prepare({ identityType, identityNumber }) {
    if (!Object.values(IDENTITY_TYPE).includes(identityType))
      throw new ValidationError('Unsupported identityType');
    if (identityType === IDENTITY_TYPE.DEPENDENT) {
      if (identityNumber) throw new ValidationError('A dependent cannot have an identity number');
      return {
        identityNumber: null,
        identityNumberHash: null,
        identityNumberEncrypted: null,
        identityNumberLast4: null,
      };
    }
    const normalized = this.normalize(identityType, identityNumber);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      identityNumber: null,
      identityNumberHash: crypto
        .createHmac('sha256', this.config.hmacSecret)
        .update(`${identityType}:${normalized}`)
        .digest('hex'),
      identityNumberEncrypted: [iv, tag, ciphertext]
        .map((value) => value.toString('base64url'))
        .join('.'),
      identityNumberLast4: normalized.slice(-4),
    };
  }
  mask(passenger) {
    return {
      ...passenger,
      identityNumber: undefined,
      identityNumberHash: undefined,
      identityNumberEncrypted: undefined,
      maskedIdentityNumber: passenger.identityNumberLast4
        ? `••••${passenger.identityNumberLast4}`
        : null,
    };
  }
}
module.exports = PassengerIdentityService;
