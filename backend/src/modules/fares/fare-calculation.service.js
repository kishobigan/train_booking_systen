'use strict';

const fareConfig = require('../../config/fare');
const FareRuleNotFoundError = require('../../common/errors/FareRuleNotFoundError');
const InvalidJourneySegmentError = require('../../common/errors/InvalidJourneySegmentError');
const FareCalculationError = require('../../common/errors/FareCalculationError');
const NotFoundError = require('../../common/errors/NotFoundError');
const ValidationError = require('../../common/errors/ValidationError');
const JourneyRepository = require('../journeys/journey.repository');
const JourneyStationRepository = require('../journeys/journey-station.repository');
const JourneySeatRepository = require('../journeys/journey-seat.repository');
const FareRuleRepository = require('./fare-rule.repository');
const FareRuleClassRepository = require('./fare-rule-class.repository');
const PassengerFareRuleRepository = require('./passenger-fare-rule.repository');
const { fareQuoteDto } = require('./fare.dto');
const { validateFareQuoteInput } = require('./fare.validator');
const money = require('../../common/utils/money');

class FareCalculationService {
  constructor({
    journeyRepository = new JourneyRepository(),
    journeyStationRepository = new JourneyStationRepository(),
    journeySeatRepository = new JourneySeatRepository(),
    fareRuleRepository = new FareRuleRepository(),
    fareRuleClassRepository = new FareRuleClassRepository(),
    passengerFareRuleRepository = new PassengerFareRuleRepository(),
    config = fareConfig,
    clock = () => new Date(),
  } = {}) {
    this.journeyRepository = journeyRepository;
    this.journeyStationRepository = journeyStationRepository;
    this.journeySeatRepository = journeySeatRepository;
    this.fareRuleRepository = fareRuleRepository;
    this.fareRuleClassRepository = fareRuleClassRepository;
    this.passengerFareRuleRepository = passengerFareRuleRepository;
    this.config = config;
    this.clock = clock;
  }

  /** Produce an informational fare quote. */
  quoteFare(input, options = {}) {
    return this.calculateBookingFare(input, options);
  }

  /** Calculate segment distance from cumulative station distances. */
  calculateDistance(originStation, destinationStation) {
    if (!originStation || !destinationStation)
      throw new InvalidJourneySegmentError('Both journey stations are required');
    if (originStation.id && originStation.id === destinationStation.id) {
      throw new InvalidJourneySegmentError('Origin and destination must be different');
    }
    if (Number(originStation.sequenceNumber) >= Number(destinationStation.sequenceNumber)) {
      throw new InvalidJourneySegmentError(
        'The selected origin must appear before the destination'
      );
    }
    const distance = money.subtract(
      destinationStation.distanceFromStartKm,
      originStation.distanceFromStartKm
    );
    if (distance.lte(0))
      throw new InvalidJourneySegmentError('Journey distance must be greater than zero');
    return distance;
  }

  /** Resolve the active route rule using the journey date. */
  async resolveFareRule({ routeId, journeyDate }, options = {}) {
    const rule = await this.fareRuleRepository.findHighestPriorityRule(
      routeId,
      journeyDate,
      options
    );
    if (!rule) throw new FareRuleNotFoundError(undefined, { routeId, journeyDate });
    if (!rule.currency || !/^[A-Z]{3}$/.test(rule.currency))
      throw new FareCalculationError('Fare rule has an invalid currency');
    return rule;
  }

  /** Resolve class overrides and apply main-rule fallbacks. */
  async resolveCoachFareRule({ fareRule, fareRuleId = fareRule?.id, coachClass }, options = {}) {
    const classRule = await this.fareRuleClassRepository.findByFareRuleAndCoachClass(
      fareRuleId,
      coachClass,
      options
    );
    return {
      classRule,
      baseFare: classRule?.baseFareOverride ?? fareRule.baseFare,
      pricePerKm: classRule?.pricePerKmOverride ?? fareRule.pricePerKm,
      minimumFare: classRule?.minimumFareOverride ?? fareRule.minimumFare,
      multiplier: classRule?.multiplier ?? '1.000',
    };
  }

  /** Calculate base fare plus distance charge. */
  calculateBaseFare({ distanceKm, baseFare, pricePerKm }) {
    const distance = money.toDecimal(distanceKm, 'distanceKm');
    const base = money.toDecimal(baseFare, 'baseFare');
    const rate = money.toDecimal(pricePerKm, 'pricePerKm');
    if (distance.lte(0) || base.lt(0) || rate.lt(0))
      throw new FareCalculationError('Fare inputs cannot be negative');
    const distanceCharge = money.roundCurrency(money.multiply(distance, rate));
    const fareBeforeMultiplier = money.roundCurrency(money.add(base, distanceCharge));
    return {
      baseFare: money.formatAmount(base),
      pricePerKm: money.formatDecimal(rate, 4),
      distanceKm: money.formatDecimal(distance, 2),
      distanceCharge: money.formatAmount(distanceCharge),
      fareBeforeMultiplier: money.formatAmount(fareBeforeMultiplier),
    };
  }

  /** Apply a positive coach-class multiplier. */
  applyCoachMultiplier({ fareBeforeMultiplier, multiplier = '1.000' }) {
    const rate = money.toDecimal(multiplier, 'multiplier');
    if (rate.lte(0)) throw new FareCalculationError('Coach multiplier must be greater than zero');
    const before = money.toDecimal(fareBeforeMultiplier);
    const after = money.roundCurrency(money.multiply(before, rate));
    return {
      multiplier: money.formatDecimal(rate, 3),
      coachMultiplierAmount: money.formatAmount(money.subtract(after, before)),
      fareAfterMultiplier: money.formatAmount(after),
    };
  }

  /** Enforce the configured minimum segment fare. */
  applyMinimumFare({ calculatedFare, minimumFare = 0 }) {
    const calculated = money.toDecimal(calculatedFare);
    const minimum = money.toDecimal(minimumFare);
    if (minimum.lt(0)) throw new FareCalculationError('Minimum fare cannot be negative');
    return {
      calculatedFare: money.formatAmount(calculated),
      minimumFare: money.formatAmount(minimum),
      minimumFareApplied: calculated.lt(minimum),
      fareAfterMinimum: money.formatAmount(money.maximum(calculated, minimum)),
    };
  }

  /** Apply the active passenger discount, defaulting to zero percent. */
  async calculatePassengerDiscount(
    { passengerType, fareBeforeDiscount, passengerRule },
    options = {}
  ) {
    const rule =
      passengerRule === undefined
        ? await this.passengerFareRuleRepository.findActiveByPassengerType(passengerType, options)
        : passengerRule;
    const rate = money.toDecimal(rule?.discountPercentage ?? 0);
    if (rate.lt(0) || rate.gt(100))
      throw new FareCalculationError('Passenger discount must be between 0 and 100');
    const before = money.toDecimal(fareBeforeDiscount);
    const discountAmount = money.roundCurrency(money.percentage(before, rate));
    return {
      passengerType,
      discountPercentage: money.formatDecimal(rate, 2),
      discountAmount: money.formatAmount(discountAmount),
      fareAfterDiscount: money.formatAmount(money.subtract(before, discountAmount)),
    };
  }

  /** Calculate a configurable booking service fee. */
  calculateServiceFee({
    subtotalAfterDiscount,
    passengerCount,
    serviceFeePolicy = this.config.serviceFee,
  }) {
    const subtotal = money.toDecimal(subtotalAfterDiscount);
    const value = money.toDecimal(serviceFeePolicy.value ?? 0);
    let amount;
    switch (serviceFeePolicy.type) {
      case 'FIXED_PER_BOOKING':
        amount = value;
        break;
      case 'FIXED_PER_PASSENGER':
        amount = money.multiply(value, passengerCount);
        break;
      case 'PERCENTAGE':
        amount = money.percentage(subtotal, value);
        break;
      case 'NONE':
        amount = money.toDecimal(0);
        break;
      default:
        throw new FareCalculationError('Unsupported service-fee policy');
    }
    return {
      type: serviceFeePolicy.type,
      rate: money.formatDecimal(value, 2),
      amount: money.formatAmount(amount),
    };
  }

  /** Calculate tax from the supplied taxable amount. */
  calculateTax({ taxableAmount, taxPolicy = this.config.tax }) {
    const taxable = money.toDecimal(taxableAmount);
    const rate = money.toDecimal(taxPolicy.percentage ?? 0);
    if (rate.lt(0)) throw new FareCalculationError('Tax percentage cannot be negative');
    const amount = taxPolicy.enabled ? money.percentage(taxable, rate) : money.toDecimal(0);
    return {
      enabled: Boolean(taxPolicy.enabled),
      percentage: money.formatDecimal(rate, 2),
      taxableAmount: money.formatAmount(taxable),
      amount: money.formatAmount(amount),
    };
  }

  /** Calculate one passenger's discounted segment fare. */
  async calculatePassengerFare({ passengerType, segmentFare, passengerRule }, options = {}) {
    const discount = await this.calculatePassengerDiscount(
      {
        passengerType,
        fareBeforeDiscount: segmentFare.fareAfterMinimum,
        passengerRule,
      },
      options
    );
    return {
      passengerType,
      baseFare: segmentFare.baseFare,
      distanceCharge: segmentFare.distanceCharge,
      coachMultiplier: segmentFare.coachMultiplier,
      fareBeforeDiscount: segmentFare.fareAfterMinimum,
      ...discount,
    };
  }

  /** Calculate the authoritative fare for a booking or quote. */
  async calculateBookingFare(input, options = {}) {
    const request = this.validateFareRequest(input);
    const journey = await this.journeyRepository.findById(request.journeyId, options);
    if (!journey) throw new NotFoundError('Journey not found', { id: request.journeyId });
    const [origin, destination] = await this.journeyStationRepository.findOriginAndDestination(
      request.journeyId,
      request.originJourneyStationId,
      request.destinationJourneyStationId,
      options
    );
    if (!origin) throw new NotFoundError('Origin journey station not found');
    if (!destination) throw new NotFoundError('Destination journey station not found');
    if (!origin.canBoard)
      throw new InvalidJourneySegmentError('Boarding is not allowed at the origin');
    if (!destination.canAlight)
      throw new InvalidJourneySegmentError('Alighting is not allowed at the destination');
    const distance = this.calculateDistance(origin, destination);
    let journeySeat = null;
    let coachClass = request.coachClass;
    if (request.journeySeatId) {
      journeySeat = await this.journeySeatRepository.findByIdWithCoach(
        request.journeySeatId,
        options
      );
      if (!journeySeat) throw new NotFoundError('Journey seat not found');
      if (journeySeat.journeyId !== request.journeyId)
        throw new ValidationError('Journey seat does not belong to the requested journey');
      const seatCoachClass = journeySeat.journeyCoach?.coachClassSnapshot;
      if (coachClass && coachClass !== seatCoachClass)
        throw new ValidationError('journeySeatId and coachClass conflict');
      coachClass = seatCoachClass;
    }
    if (!coachClass) throw new FareCalculationError('The coach class could not be resolved');
    const fareRule = await this.resolveFareRule(
      { routeId: journey.routeId, journeyDate: journey.journeyDate },
      options
    );
    const effective = await this.resolveCoachFareRule({ fareRule, coachClass }, options);
    const base = this.calculateBaseFare({
      distanceKm: distance,
      baseFare: effective.baseFare,
      pricePerKm: effective.pricePerKm,
    });
    const multiplied = this.applyCoachMultiplier({
      fareBeforeMultiplier: base.fareBeforeMultiplier,
      multiplier: effective.multiplier,
    });
    const minimum = this.applyMinimumFare({
      calculatedFare: multiplied.fareAfterMultiplier,
      minimumFare: effective.minimumFare,
    });
    const segmentFare = {
      ...base,
      coachMultiplier: multiplied.multiplier,
      coachMultiplierAmount: multiplied.coachMultiplierAmount,
      fareAfterMultiplier: multiplied.fareAfterMultiplier,
      minimumFareApplied: minimum.minimumFareApplied,
      fareAfterMinimum: minimum.fareAfterMinimum,
    };
    const activePassengerRules = await this.passengerFareRuleRepository.findActiveRules(options);
    const passengerRules = new Map(activePassengerRules.map((rule) => [rule.passengerType, rule]));
    const passengers = await Promise.all(
      request.passengers.map(async (passenger, index) => ({
        passengerNumber: index + 1,
        ...(await this.calculatePassengerFare(
          {
            passengerType: passenger.passengerType,
            segmentFare,
            passengerRule: passengerRules.get(passenger.passengerType) || null,
          },
          options
        )),
      }))
    );
    const passengerSubtotal = money.add(
      ...passengers.map((passenger) => passenger.fareAfterDiscount)
    );
    const discountTotal = money.add(...passengers.map((passenger) => passenger.discountAmount));
    const serviceFee = this.calculateServiceFee({
      subtotalAfterDiscount: passengerSubtotal,
      passengerCount: passengers.length,
    });
    const taxableAmount = this.config.tax.includesServiceFee
      ? money.add(passengerSubtotal, serviceFee.amount)
      : passengerSubtotal;
    const tax = this.calculateTax({ taxableAmount });
    const finalTotal = money.add(passengerSubtotal, serviceFee.amount, tax.amount);
    return this.createFareBreakdown({
      request,
      journey,
      origin,
      destination,
      journeySeat,
      coachClass,
      fareRule,
      effective,
      segmentFare,
      passengers,
      passengerSubtotal,
      discountTotal,
      serviceFee,
      tax,
      finalTotal,
    });
  }

  /** Shape the public fare breakdown without leaking model internals. */
  createFareBreakdown(context) {
    const station = (item) => ({
      journeyStationId: item.id,
      stationId: item.stationId,
      stationCode: item.station?.code,
      stationName: item.station?.name,
      sequenceNumber: item.sequenceNumber,
      distanceFromStartKm: money.formatDecimal(item.distanceFromStartKm, 2),
    });
    return {
      journeyId: context.journey.id,
      routeId: context.journey.routeId,
      origin: station(context.origin),
      destination: station(context.destination),
      distanceKm: context.segmentFare.distanceKm,
      coach: {
        journeySeatId: context.journeySeat?.id,
        seatId: context.journeySeat?.seatId,
        seatNumber: context.journeySeat?.seatNumberSnapshot,
        coachNumber: context.journeySeat?.journeyCoach?.coachNumberSnapshot,
        coachClass: context.coachClass,
      },
      fareRule: {
        id: context.fareRule.id,
        name: context.fareRule.name,
        currency: context.fareRule.currency,
        baseFare: money.formatAmount(context.effective.baseFare),
        pricePerKm: money.formatDecimal(context.effective.pricePerKm, 4),
        minimumFare: money.formatAmount(context.effective.minimumFare),
        coachMultiplier: money.formatDecimal(context.effective.multiplier, 3),
      },
      segmentFare: context.segmentFare,
      passengers: context.passengers,
      totals: {
        passengerSubtotal: money.formatAmount(context.passengerSubtotal),
        discountTotal: money.formatAmount(context.discountTotal),
        serviceFee: context.serviceFee.amount,
        taxableAmount: context.tax.taxableAmount,
        taxPercentage: context.tax.percentage,
        taxAmount: context.tax.amount,
        finalTotal: money.formatAmount(context.finalTotal),
        currency: context.fareRule.currency,
      },
      calculatedAt: this.clock().toISOString(),
    };
  }

  /** Normalize and validate a fare request. */
  validateFareRequest(input) {
    return validateFareQuoteInput(fareQuoteDto(input), this.config.maximumPassengersPerBooking);
  }
}

module.exports = FareCalculationService;
