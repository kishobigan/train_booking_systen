require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const trainsRouter = require('./routes/trains');
const bookingsRouter = require('./routes/bookings');

const app = express();
const PORT = process.env.PORT || 4050;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/trains', trainsRouter);
app.use('/api/bookings', bookingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
