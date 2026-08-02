'use strict';
function maskDestination(value = '') {
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name[0] || '*'}***${name.at(-1) || '*'}@${domain}`;
  }
  return value.length > 6 ? `${value.slice(0, 5)}*****${value.slice(-2)}` : '***';
}
function toPassengerNotificationDto(item) {
  return {
    id: item.id,
    channel: item.channel,
    templateCode: item.templateCode,
    status: item.status,
    subject: item.subject,
    createdAt: item.createdAt,
    sentAt: item.sentAt,
  };
}
function toAdminNotificationDto(item, { detail = false } = {}) {
  return {
    ...toPassengerNotificationDto(item),
    destination: detail ? item.destination : maskDestination(item.destination),
    bookingId: item.bookingId,
    journeyId: item.journeyId,
    attemptCount: item.attemptCount,
    maxAttempts: item.maxAttempts,
    providerName: item.providerName,
    providerReference: item.providerReference,
    failureCode: item.failureCode,
    failureMessage: item.failureMessage,
    nextRetryAt: item.nextRetryAt,
  };
}
function toDeliveryResultDto(item) {
  return {
    id: item.id,
    status: item.status,
    sentAt: item.sentAt,
    providerReference: item.providerReference,
    nextRetryAt: item.nextRetryAt,
    failureCode: item.failureCode,
  };
}
module.exports = {
  maskDestination,
  toPassengerNotificationDto,
  toAdminNotificationDto,
  toDeliveryResultDto,
};
