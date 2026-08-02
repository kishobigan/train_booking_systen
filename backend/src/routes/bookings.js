const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, t.name AS train_name, t.source, t.destination
      FROM bookings b
      JOIN trains t ON t.id = b.train_id
      ORDER BY b.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.post('/', async (req, res) => {
  const { train_id, passenger_name, passenger_email, seats_booked } = req.body;

  if (!train_id || !passenger_name || !passenger_email || !seats_booked) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (seats_booked < 1) {
    return res.status(400).json({ error: 'Must book at least 1 seat' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const trainResult = await client.query(
      'SELECT * FROM trains WHERE id = $1 FOR UPDATE',
      [train_id]
    );

    if (trainResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Train not found' });
    }

    const train = trainResult.rows[0];

    if (train.available_seats < seats_booked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough seats available' });
    }

    const total_price = Number(train.price) * seats_booked;

    const bookingResult = await client.query(
      `INSERT INTO bookings (train_id, passenger_name, passenger_email, seats_booked, total_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [train_id, passenger_name, passenger_email, seats_booked, total_price]
    );

    await client.query(
      'UPDATE trains SET available_seats = available_seats - $1 WHERE id = $2',
      [seats_booked, train_id]
    );

    await client.query('COMMIT');

    res.status(201).json(bookingResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

module.exports = router;
