'use client';

import { useState } from 'react';
import { Train, createBooking, formatDateTime, formatPrice } from '@/lib/api';

interface Props {
  train: Train;
  onSuccess: () => void;
}

export default function BookingModal({ train, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createBooking({
        train_id: train.id,
        passenger_name: name,
        passenger_email: email,
        seats_booked: seats,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onSuccess}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Book {train.name}</h2>
        <p className="route">
          {train.source} → {train.destination}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Passenger Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="seats">Seats</label>
            <select
              id="seats"
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            >
              {Array.from({ length: Math.min(train.available_seats, 10) }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>

          <p className="price">
            Total: {formatPrice(Number(train.price) * seats)}
          </p>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onSuccess}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TrainCardProps {
  train: Train;
  onBook: (train: Train) => void;
}

export function TrainCard({ train, onBook }: TrainCardProps) {
  return (
    <div className="card">
      <div className="train-name">{train.name}</div>
      <div className="route">
        {train.source} → {train.destination}
      </div>
      <div className="meta">
        <span>Departs: {formatDateTime(train.departure_time)}</span>
        <span>Arrives: {formatDateTime(train.arrival_time)}</span>
        <span>{train.available_seats} seats left</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="price">{formatPrice(train.price)}</span>
        <button
          className="btn btn-primary"
          onClick={() => onBook(train)}
          disabled={train.available_seats === 0}
        >
          {train.available_seats === 0 ? 'Sold Out' : 'Book Now'}
        </button>
      </div>
    </div>
  );
}
