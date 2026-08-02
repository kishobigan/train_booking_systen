import { io, Socket } from 'socket.io-client';
export function createSeatMapSocket(token?: string): Socket {
  return io(process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4050', {
    path: process.env.NEXT_PUBLIC_WEBSOCKET_PATH || '/socket.io',
    auth: token ? { token } : {}, transports: ['websocket', 'polling'], autoConnect: true,
  });
}
