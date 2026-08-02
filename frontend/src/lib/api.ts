const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4050';

export interface Train {
  id: number;
  name: string;
  source: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  total_seats: number;
  available_seats: number;
  price: string;
}

export interface Booking {
  id: number;
  train_id: number;
  passenger_name: string;
  passenger_email: string;
  seats_booked: number;
  total_price: string;
  status: string;
  created_at: string;
  train_name?: string;
  source?: string;
  destination?: string;
}

export async function fetchTrains(): Promise<Train[]> {
  const res = await fetch(`${API_URL}/api/trains`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch trains');
  return res.json();
}

export async function fetchBookings(): Promise<Booking[]> {
  const res = await fetch(`${API_URL}/api/bookings`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
}

export async function createBooking(data: {
  train_id: number;
  passenger_name: string;
  passenger_email: string;
  seats_booked: number;
}): Promise<Booking> {
  const res = await fetch(`${API_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to create booking');
  return body;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPrice(price: string | number): string {
  return `$${Number(price).toFixed(2)}`;
}
