import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@yeopjan/shared';

export const sessionTokenKey = 'yeopjan.session';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  auth: { token: localStorage.getItem(sessionTokenKey) ?? undefined },
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4_000
});
