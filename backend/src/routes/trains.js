const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM trains ORDER BY departure_time ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trains' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM trains WHERE id = $1', [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Train not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch train' });
  }
});

module.exports = router;
