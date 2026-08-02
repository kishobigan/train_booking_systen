-- 002: Create enum types

CREATE TYPE user_role AS ENUM (
    'PASSENGER',
    'STAFF',
    'ADMIN',
    'SUPER_ADMIN'
);

CREATE TYPE coach_class AS ENUM (
    'FIRST_CLASS',
    'SECOND_CLASS',
    'THIRD_CLASS',
    'OBSERVATION_CLASS',
    'SLEEPER'
);

CREATE TYPE coach_reservation_type AS ENUM (
    'RESERVED',
    'UNRESERVED'
);

CREATE TYPE journey_status AS ENUM (
    'DRAFT',
    'SCHEDULED',
    'BOARDING',
    'DEPARTED',
    'COMPLETED',
    'DELAYED',
    'CANCELLED'
);

CREATE TYPE seat_status AS ENUM (
    'AVAILABLE',
    'BLOCKED',
    'MAINTENANCE',
    'UNAVAILABLE'
);

CREATE TYPE booking_status AS ENUM (
    'PENDING',
    'HELD',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED',
    'COMPLETED',
    'REFUNDED'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'PAID',
    'FAILED',
    'CANCELLED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
);

CREATE TYPE payment_method AS ENUM (
    'CARD',
    'BANK_TRANSFER',
    'CASH',
    'MOBILE_PAYMENT',
    'WALLET'
);

CREATE TYPE passenger_type AS ENUM (
    'ADULT',
    'CHILD',
    'SENIOR',
    'STUDENT',
    'DISABLED'
);

CREATE TYPE waitlist_status AS ENUM (
    'WAITING',
    'OFFERED',
    'CONVERTED',
    'EXPIRED',
    'CANCELLED'
);

CREATE TYPE notification_channel AS ENUM (
    'EMAIL',
    'SMS',
    'PUSH'
);

CREATE TYPE notification_status AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);
