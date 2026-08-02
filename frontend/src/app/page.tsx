'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Train,
  Booking,
  fetchTrains,
  fetchBookings,
  formatDateTime,
  formatPrice,
} from '@/lib/api';
import BookingModal, { TrainCard } from '@/components/BookingModal';

export default function HomePage() {
  const [trains, setTrains] = useState<Train[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [trainsData, bookingsData] = await Promise.all([
        fetchTrains(),
        fetchBookings(),
      ]);
      setTrains(trainsData);
      setBookings(bookingsData);
    } catch {
      setError('Unable to connect to the API. Make sure the backend is running on port 4050.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBookingSuccess = () => {
    setSelectedTrain(null);
    setSuccessMsg('Booking confirmed successfully!');
    loadData();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <>
      <header>
        <div className="container">
          <h1>Train Booking System</h1>
          <p>Find and book your next journey</p>
        </div>
      </header>

      <main className="container">
        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 className="section-title">Available Trains</h2>
          {loading ? (
            <div className="loading">Loading trains...</div>
          ) : trains.length === 0 ? (
            <div className="empty">No trains available.</div>
          ) : (
            <div className="grid train-grid">
              {trains.map((train) => (
                <TrainCard
                  key={train.id}
                  train={train}
                  onBook={setSelectedTrain}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="section-title">Recent Bookings</h2>
          {loading ? (
            <div className="loading">Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div className="empty">No bookings yet.</div>
          ) : (
            <div className="card">
              {bookings.map((booking) => (
                <div key={booking.id} className="booking-item">
                  <div>
                    <strong>{booking.train_name}</strong>
                    <div className="route">
                      {booking.source} → {booking.destination}
                    </div>
                    <div className="meta">
                      <span>{booking.passenger_name}</span>
                      <span>{booking.seats_booked} seat(s)</span>
                      <span>{formatDateTime(booking.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="price">{formatPrice(booking.total_price)}</div>
                    <span className="status-badge">{booking.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedTrain && (
        <BookingModal train={selectedTrain} onSuccess={handleBookingSuccess} />
      )}
    </>
  );
}
