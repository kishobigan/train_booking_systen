'use strict';

const NotFoundError = require('../../common/errors/NotFoundError');
const ManagementRepository = require('./management.repository');

const SENSITIVE = /password|token|secret|identityNumber|providerResponse|storageKey/i;
const cleanObject = (value) => {
  if (Array.isArray(value)) return value.map(cleanObject);
  if (!value || typeof value !== 'object') return value;
  const source = value.toJSON ? value.toJSON() : value;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !SENSITIVE.test(key))
      .map(([key, child]) => [key, cleanObject(child)])
  );
};

class ManagementService {
  constructor({ repository = new ManagementRepository(), models } = {}) {
    this.repository = repository;
    this.models = models || require('../../models');
  }

  async list(resource, query) {
    const methods = {
      trains: 'listTrains', stations: 'listStations', journeys: 'listJourneys', bookings: 'listBookings',
      payments: 'listPayments', waitlist: 'listWaitlist', users: 'listUsers', auditLogs: 'listAuditLogs',
    };
    const method = methods[resource];
    if (!method) throw new NotFoundError('Management resource not found');
    const result = await this.repository[method](query);
    return { ...result, items: cleanObject(result.items) };
  }

  async detail(resource, id) {
    const model = {
      trains: this.models.Train, journeys: this.models.Journey, bookings: this.models.Booking,
      payments: this.models.Payment, waitlist: this.models.WaitlistEntry, users: this.models.User,
      auditLogs: this.models.AuditLog,
    }[resource];
    if (!model) throw new NotFoundError('Management resource not found');
    const record = await model.findByPk(id);
    if (!record) throw new NotFoundError('Record not found', { id });
    return cleanObject(record);
  }
}

module.exports = ManagementService;
