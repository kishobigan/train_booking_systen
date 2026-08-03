'use strict';

const { Op, col, where: sqlWhere } = require('sequelize');
const models = require('../../models');

const pageInput = (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
};

const pagination = (page, limit, totalItems) => ({
  page,
  limit,
  totalItems,
  totalPages: Math.ceil(totalItems / limit),
  hasNextPage: page * limit < totalItems,
  hasPreviousPage: page > 1,
});

const textSearch = (query, fields) => {
  const search = String(query.search || '').trim();
  return search
    ? { [Op.or]: fields.map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } })) }
    : {};
};

class ManagementRepository {
  async findAndPage(model, query, { where = {}, include, order = [['createdAt', 'DESC']], subQuery } = {}) {
    const { page, limit, offset } = pageInput(query);
    const result = await model.findAndCountAll({ where, include, order, limit, offset, distinct: true, subQuery });
    return { items: result.rows, pagination: pagination(page, limit, result.count) };
  }

  listTrains(query) {
    const where = {
      ...textSearch(query, ['trainNumber', 'name']),
      ...(query.accessibleTrainIds && { id: { [Op.in]: query.accessibleTrainIds } }),
      ...(query.status && { isActive: query.status === 'ACTIVE' }),
    };
    return this.findAndPage(models.Train, query, {
      where,
      include: [
        { model: models.Coach, as: 'coaches', attributes: ['id', 'reservationType', 'totalSeats'], required: false },
        { model: models.Journey, as: 'journeys', attributes: ['id', 'status'], required: false },
      ],
      order: [['trainNumber', 'ASC']],
    });
  }
  listStations(query) {
    return this.findAndPage(models.Station, query, { where: { ...textSearch(query, ['code','name','city','district']), ...(query.accessibleStationIds && { id: { [Op.in]: query.accessibleStationIds } }) }, order: [['name','ASC']] });
  }

  listJourneys(query) {
    const where = {
      ...textSearch(query, ['serviceNumber']),
      ...(query.status && { status: query.status }),
      ...(query.routeId && { routeId: query.routeId }),
      ...(query.trainId && { trainId: query.trainId }),
      ...(query.accessibleTrainIds && { trainId: { [Op.in]: query.accessibleTrainIds } }),
      ...(query.dateFrom || query.dateTo
        ? { journeyDate: { ...(query.dateFrom && { [Op.gte]: query.dateFrom }), ...(query.dateTo && { [Op.lte]: query.dateTo }) } }
        : {}),
    };
    return this.findAndPage(models.Journey, query, {
      where,
      include: [
        { model: models.Train, as: 'train', attributes: ['id', 'trainNumber', 'name'] },
        { model: models.Route, as: 'route', attributes: ['id', 'code', 'name'] },
        ...(query.accessibleStationIds ? [{ model: models.JourneyStation, as: 'journeyStations', attributes: [], required: true, where: { stationId: { [Op.in]: query.accessibleStationIds } } }] : []),
      ],
      order: [['scheduledDepartureAt', 'DESC']],
    });
  }

  listBookings(query) {
    const where = {
      ...textSearch(query, ['bookingReference', 'contactName', 'contactEmail', 'contactPhone']),
      ...(query.bookingStatus && { status: query.bookingStatus }),
      ...(query.journeyId && { journeyId: query.journeyId }),
      ...(query.accessibleStationIds && {
        [Op.or]: [
          sqlWhere(col('originJourneyStation.station_id'), { [Op.in]: query.accessibleStationIds }),
          sqlWhere(col('destinationJourneyStation.station_id'), { [Op.in]: query.accessibleStationIds }),
        ],
      }),
    };
    return this.findAndPage(models.Booking, query, {
      where,
      subQuery: query.accessibleStationIds ? false : undefined,
      include: [
        { model: models.Journey, as: 'journey', attributes: ['id', 'serviceNumber', 'journeyDate'], required: Boolean(query.accessibleTrainIds), where: query.accessibleTrainIds ? { trainId: { [Op.in]: query.accessibleTrainIds } } : undefined },
        { model: models.Payment, as: 'payments', attributes: ['id', 'status', 'method', 'paymentReference'] },
        ...(query.accessibleStationIds ? [{ model: models.JourneyStation, as: 'originJourneyStation', attributes: ['stationId'], required: false }, { model: models.JourneyStation, as: 'destinationJourneyStation', attributes: ['stationId'], required: false }] : []),
      ],
    });
  }

  listPayments(query) {
    const where = {
      ...textSearch(query, ['paymentReference', 'providerReference']),
      ...(query.method && { method: query.method }),
      ...(query.status && { status: query.status }),
    };
    return this.findAndPage(models.Payment, query, {
      where,
      include: [
        { model: models.Booking, as: 'booking', attributes: ['id', 'bookingReference', 'journeyId', 'contactName'], required: Boolean(query.accessibleTrainIds), include: query.accessibleTrainIds ? [{ model: models.Journey, as: 'journey', attributes: [], required: true, where: { trainId: { [Op.in]: query.accessibleTrainIds } } }] : [] },
        { model: models.BankPaymentSlip, as: 'bankSlips', required: false },
      ],
    });
  }

  listWaitlist(query) {
    const where = {
      ...textSearch(query, ['contactName', 'contactEmail', 'contactPhone']),
      ...(query.status && { status: query.status }),
      ...(query.journeyId && { journeyId: query.journeyId }),
      ...(query.coachClass && { requestedCoachClass: query.coachClass }),
    };
    return this.findAndPage(models.WaitlistEntry, query, {
      where,
      include: [{ model: models.Journey, as: 'journey', attributes: ['id', 'serviceNumber', 'journeyDate'], required: Boolean(query.accessibleTrainIds), where: query.accessibleTrainIds ? { trainId: { [Op.in]: query.accessibleTrainIds } } : undefined }],
      order: [['priorityNumber', 'ASC']],
    });
  }

  listUsers(query) {
    const where = {
      role: { [Op.in]: ['SUPER_ADMIN', 'ADMIN', 'STAFF'] },
      ...textSearch(query, ['fullName', 'email', 'phoneNumber']),
      ...(query.role && { role: query.role }),
      ...(query.status && { isActive: query.status === 'ACTIVE' }),
      ...(query.blocked !== undefined && { blockedAt: String(query.blocked) === 'true' ? { [Op.ne]: null } : null }),
    };
    return this.findAndPage(models.User, query, {
      where,
      include: [
        { model: models.Journey, as: 'adminJourneys', attributes: ['id', 'serviceNumber'], through: { attributes: [] }, required: false },
        { model: models.Station, as: 'staffStations', attributes: ['id', 'code', 'name'], through: { attributes: [] }, required: false },
      ],
      order: [['fullName', 'ASC']],
    });
  }

  listAuditLogs(query) {
    const where = {
      ...textSearch(query, ['action', 'entityType']),
      ...(query.actorId && { userId: query.actorId }),
      ...(query.action && { action: query.action }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { ...(query.dateFrom && { [Op.gte]: new Date(query.dateFrom) }), ...(query.dateTo && { [Op.lte]: new Date(query.dateTo) }) } }
        : {}),
    };
    return this.findAndPage(models.AuditLog, query, {
      where,
      include: [{ model: models.User, as: 'user', attributes: ['id', 'fullName', 'email', 'role'], required: false }],
    });
  }
}

module.exports = ManagementRepository;
