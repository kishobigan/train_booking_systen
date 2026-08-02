-- 001: Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Drop legacy prototype tables from initial scaffold
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS trains CASCADE;
