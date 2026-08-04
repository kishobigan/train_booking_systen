'use strict';

const crypto = require('node:crypto');
const ValidationError = require('../../common/errors/ValidationError');
const NotFoundError = require('../../common/errors/NotFoundError');
const AuthorizationError = require('../../common/errors/AuthorizationError');
const BOOKING_STATUS = require('../../common/constants/booking-status.constants');
const WAITLIST_STATUS = require('../../common/constants/waitlist-status.constants');
const IDENTITY_TYPE = require('../../common/constants/passenger-identity-type.constants');

class BookingAccessService {
  constructor({
    bookingRepository,
    waitlistRepository,
    passengerIdentityService,
    guestBookingAccessService,
    notificationService,
    clock = () => new Date(),
    otpTtlMinutes = 15,
    maxAttempts = 5,
    developmentOtp = process.env.NODE_ENV === 'production' ? null : '123456',
  }) {
    Object.assign(this, {
      bookingRepository,
      waitlistRepository,
      passengerIdentityService,
      guestBookingAccessService,
      notificationService,
      clock,
      otpTtlMinutes,
      maxAttempts,
      developmentOtp,
    });
    this.requests = new Map();
  }

  async requestAccess(input = {}) {
    const primaryNic = this.#normalizeNic(input.primaryNic);
    const bookingReference = String(input.bookingReference || '').trim();
    const contact = this.#normalizeContact(input.contact);
    if (!bookingReference && !contact.email && !contact.phone) {
      throw new ValidationError('A booking reference or registered contact is required');
    }
    const requestId = crypto.randomUUID();
    const record = {
      requestId,
      bookingId: null,
      primaryNicHash: null,
      contact,
      otpHash: this.#hashOtp('000000'),
      attempts: 0,
      expiresAt: new Date(this.clock().getTime() + this.otpTtlMinutes * 60_000),
    };

    const matchedBooking = bookingReference
      ? await this.bookingRepository.findByReference(bookingReference)
      : await this.bookingRepository.findOne(
          contact.email ? { contactEmail: contact.email } : { contactPhone: contact.phone }
        );
    const customerMatches = this.#bookingMatches(matchedBooking, primaryNic, contact);
    if (matchedBooking && (customerMatches || this.developmentOtp)) {
      const otp = this.#generateOtp();
      record.bookingId = matchedBooking.id;
      record.primaryNicHash = this.#identityHash(primaryNic);
      record.otpHash = this.#hashOtp(otp);
      record.otp = otp;
      await this.#notifyOtp({ booking: matchedBooking, otp, expiresAt: record.expiresAt });
    }
    this.requests.set(requestId, record);
    return {
      requestId,
      message:
        'If the information matches our records, a verification code has been sent to the registered contact.',
    };
  }

  async verifyAccess({ requestId, otp }) {
    const request = this.requests.get(String(requestId || ''));
    if (!request) throw new AuthorizationError('Invalid or expired verification code');
    if (request.expiresAt <= this.clock()) {
      this.requests.delete(requestId);
      throw new AuthorizationError('Invalid or expired verification code');
    }
    if (request.attempts >= this.maxAttempts)
      throw new AuthorizationError('Verification code attempt limit reached');
    request.attempts += 1;
    if (this.#hashOtp(String(otp || '')) !== request.otpHash)
      throw new AuthorizationError('Invalid or expired verification code');
    if (!request.bookingId) throw new AuthorizationError('Invalid or expired verification code');
    const access = this.guestBookingAccessService.issue();
    const booking = await this.bookingRepository.findById(request.bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    await booking.update({
      guestAccessTokenHash: access.hash,
      guestAccessTokenExpiresAt: access.expiresAt,
    });
    this.requests.delete(requestId);
    return {
      bookingId: request.bookingId,
      guestAccessToken: access.token,
      guestAccessTokenExpiresAt: access.expiresAt,
    };
  }

  async getCustomerActivity({ bookingId, token }) {
    const booking = await this.guestBookingAccessService.authorize(bookingId, token);
    const details = await this.bookingRepository.findDetails(booking.id);
    if (!details) throw new NotFoundError('Booking not found');
    const waitlistEntries = await this.waitlistRepository.findByContact(
      { email: details.contactEmail, phone: details.contactPhone },
      {}
    );
    const passengers = [...(details.passengers || [])];
    const primaryPassenger = passengers.find((passenger) => passenger.passengerNumber === 1) || passengers[0];
    const latestPayment = [...(details.payments || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0] || null;
    const maskedNic = primaryPassenger?.maskedIdentityNumber || null;
    const bookingSummary = this.#bookingSummary(details, latestPayment);
    return {
      customer: {
        primaryPassengerName: primaryPassenger?.fullName || details.contactName,
        maskedNic,
      },
      bookings: [bookingSummary],
      waitlistEntries: waitlistEntries.map((entry) => this.#waitlistSummary(entry)),
      summary: {
        activeBookings: 1,
        pendingPayments: [BOOKING_STATUS.HELD, BOOKING_STATUS.PENDING].includes(details.status)
          ? 1
          : 0,
        confirmedTickets: ['CONFIRMED', 'COMPLETED'].includes(details.status) ? 1 : 0,
        activeWaitlistEntries: waitlistEntries.filter((entry) =>
          [WAITLIST_STATUS.WAITING, WAITLIST_STATUS.OFFERED].includes(entry.status)
        ).length,
      },
    };
  }

  endGuestAccess() {
    return true;
  }

  #bookingMatches(booking, primaryNic, contact) {
    if (!booking) return false;
    const contactMatches =
      (!contact.email && !contact.phone) ||
      booking.contactEmail?.toLowerCase() === contact.email?.toLowerCase() ||
      booking.contactPhone === contact.phone;
    if (!contactMatches) return false;
    const primaryPassenger = (booking.passengers || []).find((passenger) => passenger.passengerNumber === 1);
    if (!primaryPassenger?.identityNumberHash) return false;
    return primaryPassenger.identityNumberHash === this.#identityHash(primaryNic);
  }

  #bookingSummary(booking, latestPayment) {
    const passengers = (booking.passengers || []).map((passenger) => ({
      id: passenger.id,
      fullName: passenger.fullName,
      passengerNumber: passenger.passengerNumber,
      passengerType: passenger.passengerType,
      relationship: passenger.guardianRelationship || null,
      maskedIdentityNumber: passenger.maskedIdentityNumber || null,
      assignedSeat: passenger.assignedSeat
        ? {
            seatNumber: passenger.assignedSeat.seatNumberSnapshot || passenger.assignedSeat.seatNumber,
            coachNumber: passenger.assignedSeat.coachNumberSnapshot || passenger.assignedSeat.coachNumber,
          }
        : null,
      isPrimaryPassenger: passenger.passengerNumber === 1,
    }));
    const seats = (booking.bookingSeats || []).map((seat) => ({
      passengerNumber: passengers.find((passenger) => passenger.id === seat.bookingPassengerId)?.passengerNumber || null,
      seatNumber: seat.seatNumberSnapshot,
      coachNumber: seat.coachNumberSnapshot,
      coachClass: seat.coachClassSnapshot,
    }));
    return {
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      journey: booking.journey,
      segment: {
        originJourneyStation: booking.originJourneyStation,
        destinationJourneyStation: booking.destinationJourneyStation,
      },
      paymentStatus: latestPayment?.status || 'AWAITING_PAYMENT',
      ticketStatus: ['CONFIRMED', 'COMPLETED'].includes(booking.status) ? 'AVAILABLE' : 'UNAVAILABLE',
      passengerCount: booking.passengerCount,
      passengers,
      seats,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      latestPayment: latestPayment && {
        id: latestPayment.id,
        status: latestPayment.status,
        method: latestPayment.method,
      },
    };
  }

  #waitlistSummary(entry) {
    return {
      waitlistEntryId: entry.id,
      waitlistReference: entry.id,
      journey: entry.journey,
      status: entry.status,
      passengerCount: entry.passengerCount,
      requestedCoachClass: entry.requestedCoachClass,
      currentPosition: entry.priorityNumber,
      joinedAt: entry.createdAt,
      offerExpiry: entry.offerExpiresAt,
      convertedBookingReference: entry.convertedBooking?.bookingReference || null,
      offeredSeat: entry.offeredSeat
        ? {
            seatNumber: entry.offeredSeat.seatNumber,
            coachNumber: entry.offeredSeat.coachNumber,
          }
        : null,
      contactName: entry.contactName,
    };
  }

  #normalizeNic(value) {
    return this.passengerIdentityService.normalize(IDENTITY_TYPE.NIC, value);
  }

  #identityHash(value) {
    return this.passengerIdentityService.prepare({ identityType: IDENTITY_TYPE.NIC, identityNumber: value }).identityNumberHash;
  }

  #normalizeContact(contact) {
    return {
      email: String(contact?.email || '').trim().toLowerCase() || null,
      phone: String(contact?.phone || '').trim() || null,
    };
  }

  #generateOtp() {
    if (this.developmentOtp) return this.developmentOtp;
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  #hashOtp(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
  }

  async #notifyOtp({ booking, otp, expiresAt }) {
    if (!this.notificationService) return;
    const payload = {
      customerName: booking.contactName || 'Passenger',
      otpCode: otp,
      expiresAt: expiresAt.toLocaleString('en-LK'),
      userId: booking.userId || null,
      bookingId: booking.id,
      metadata: { type: 'BOOKING_ACCESS_OTP' },
    };
    const notifications = [];
    if (booking.contactEmail) {
      notifications.push(
        this.notificationService.queueEmail({
          ...payload,
          destination: booking.contactEmail,
          templateCode: 'BOOKING_ACCESS_OTP',
          category: 'booking_access',
          mandatory: true,
        })
      );
    }
    if (booking.contactPhone) {
      notifications.push(
        this.notificationService.queueSms({
          ...payload,
          destination: booking.contactPhone,
          templateCode: 'BOOKING_ACCESS_OTP',
          category: 'booking_access',
          mandatory: true,
        })
      );
    }
    await Promise.allSettled(notifications);
  }
}

module.exports = BookingAccessService;
