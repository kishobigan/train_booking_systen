require('dotenv').config();
const pool = require('../config/db');

const migrate = async () => {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS trains (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        departure_time TIMESTAMP NOT NULL,
        arrival_time TIMESTAMP NOT NULL,
        total_seats INTEGER NOT NULL DEFAULT 100,
        available_seats INTEGER NOT NULL DEFAULT 100,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        train_id INTEGER NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
        passenger_name VARCHAR(255) NOT NULL,
        passenger_email VARCHAR(255) NOT NULL,
        seats_booked INTEGER NOT NULL DEFAULT 1,
        total_price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM trains');
    if (rows[0].count === 0) {
      await client.query(`
        INSERT INTO trains (name, source, destination, departure_time, arrival_time, total_seats, available_seats, price)
        VALUES
          ('Express 101', 'New York', 'Boston', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '5 hours', 120, 120, 45.00),
          ('Coastal Line', 'San Francisco', 'Los Angeles', NOW() + INTERVAL '4 hours', NOW() + INTERVAL '10 hours', 200, 200, 89.50),
          ('Mountain Rail', 'Denver', 'Salt Lake City', NOW() + INTERVAL '6 hours', NOW() + INTERVAL '12 hours', 150, 150, 72.00),
          ('Midnight Express', 'Chicago', 'Detroit', NOW() + INTERVAL '8 hours', NOW() + INTERVAL '14 hours', 180, 180, 55.00);
      `);
      console.log('Seed data inserted.');
    }

    console.log('Migration completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
