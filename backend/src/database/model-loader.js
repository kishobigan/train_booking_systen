'use strict';

const modelClasses = [
  require('../models/User'),
  require('../models/RefreshToken'),
  require('../models/AdminJourney'),
  require('../models/StaffStation'),
  require('../models/Station'),
  require('../models/Route'),
  require('../models/RouteStation'),
  require('../models/Train'),
  require('../models/Coach'),
  require('../models/Seat'),
  require('../models/Journey'),
  require('../models/JourneyStation'),
  require('../models/JourneyCoach'),
  require('../models/JourneySeat'),
  require('../models/FareRule'),
  require('../models/FareRuleClass'),
  require('../models/PassengerFareRule'),
  require('../models/Booking'),
  require('../models/BookingPassenger'),
  require('../models/BookingSeat'),
  require('../models/ActiveSeatAllocation'),
  require('../models/Payment'),
  require('../models/Refund'),
  require('../models/PaymentWebhookEvent'),
  require('../models/BankPaymentSlip'),
  require('../models/IdempotencyRecord'),
  require('../models/PaymentReconciliationLog'),
  require('../models/BookingStatusHistory'),
  require('../models/WaitlistEntry'),
  require('../models/Notification'),
  require('../models/AuditLog'),
  require('../models/JourneyDisruption'),
  require('../models/JobExecution'),
];

const loadedInstances = new WeakMap();

function loadModels(sequelize) {
  if (loadedInstances.has(sequelize)) return loadedInstances.get(sequelize);

  const models = Object.fromEntries(
    modelClasses.map((ModelClass) => [ModelClass.name, ModelClass.initModel(sequelize)])
  );

  for (const ModelClass of modelClasses) ModelClass.associate?.(models);

  loadedInstances.set(sequelize, models);
  return models;
}

module.exports = loadModels;
