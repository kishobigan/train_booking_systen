'use client';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { authTokenStore } from '@/services/http/auth-token-store';
class SocketManager {
  private socket: Socket | null = null;
  get() { if (!this.socket) this.socket = io(env.websocketUrl, { path: env.websocketPath, autoConnect: false, transports: ['websocket', 'polling'], auth: (callback) => callback({ token: authTokenStore.getAccessToken() }) }); return this.socket; }
  connect() { const socket = this.get(); if (!socket.connected) socket.connect(); return socket; }
  disconnect() { this.socket?.disconnect(); this.socket = null; }
}
export const socketManager = new SocketManager();
