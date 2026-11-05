import { afterEach, describe, expect, it, vi } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';
import type { Ack, BarSnapshot, ClientToServerEvents, ServerToClientEvents } from '@yeopjan/shared';
import { createApp } from '../src/app.js';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const sockets: TestSocket[] = [];
const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  for (const close of closers.splice(0)) await close();
});

function once<T>(socket: TestSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), 2_000);
    socket.once(event as any, (value: T) => { clearTimeout(timer); resolve(value); });
  });
}

function emitAck<T = undefined>(socket: TestSocket, event: string, payload?: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (payload === undefined) (socket.emit as any)(event, resolve);
    else (socket.emit as any)(event, payload, resolve);
  });
}

async function setup() {
  const server = await createApp({ databasePath: ':memory:', allowedOrigins: ['http://localhost:5173'], disconnectGraceMs: 30, adminToken: 'test-admin' });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  closers.push(server.close);
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error('missing server address');
  const url = `http://127.0.0.1:${address.port}`;
  const client = (token?: string) => {
    const socket: TestSocket = createClient(url, { transports: ['websocket'], auth: { token }, extraHeaders: { Origin: 'http://localhost:5173' }, forceNew: true });
    sockets.push(socket);
    return socket;
  };
  return { ...server, url, client };
}

const profile = (nickname: string) => ({ nickname, avatar: 'amber' as const, mood: 'chat' as const, adultConfirmed: true as const });

describe('real multiplayer server', () => {
  it('syncs users, resolves seat contention, isolates chat and delivers cheers by channel', async () => {
    const { client } = await setup();
    const a = client(); const b = client(); const c = client();
    await Promise.all([once(a, 'connect'), once(b, 'connect'), once(c, 'connect')]);

    const aJoin = await emitAck<{ token: string; snapshot: BarSnapshot }>(a, 'bar:join', profile('밤산책'));
    expect(aJoin.ok).toBe(true);
    const aId = aJoin.ok ? aJoin.data.snapshot.selfId! : '';
    const aSeesB = once<{ id: string }>(a, 'bar:user-joined');
    const bJoin = await emitAck<{ token: string; snapshot: BarSnapshot }>(b, 'bar:join', profile('느린파도'));
    expect(bJoin.ok && bJoin.data.snapshot.users.some((user) => user.id === aId)).toBe(true);
    expect((await aSeesB).id).toBe(bJoin.ok ? bJoin.data.snapshot.selfId : '');
    const cJoin = await emitAck<{ token: string; snapshot: BarSnapshot }>(c, 'bar:join', profile('고요한잔'));
    expect(cJoin.ok).toBe(true);

    const [aSeat, bSeat] = await Promise.all([
      emitAck(a, 'bar:seat', { seatId: 'counter-1' }),
      emitAck(b, 'bar:seat', { seatId: 'counter-1' })
    ]);
    expect([aSeat.ok, bSeat.ok].filter(Boolean)).toHaveLength(1);
    const counterSocket = aSeat.ok ? a : b;
    const otherCounterSocket = aSeat.ok ? b : a;
    expect((await emitAck(otherCounterSocket, 'bar:seat', { seatId: 'counter-2' })).ok).toBe(true);
    expect((await emitAck(c, 'bar:seat', { seatId: 'table-2-1' })).ok).toBe(true);

    const counterChat = once<{ text: string }>(otherCounterSocket, 'bar:chat');
    const cChat = vi.fn(); c.on('bar:chat', cChat);
    expect((await emitAck(counterSocket, 'bar:chat', { text: '<script>alert(1)</script>' })).ok).toBe(true);
    expect((await counterChat).text).toBe('<script>alert(1)</script>');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(cChat).not.toHaveBeenCalled();

    const counterAuthorId = aSeat.ok ? aId : (bJoin.ok ? bJoin.data.snapshot.selfId! : '');
    expect((await emitAck(otherCounterSocket, 'bar:block', { targetId: counterAuthorId })).ok).toBe(true);
    const blockedChat = vi.fn(); otherCounterSocket.on('bar:chat', blockedChat);
    expect((await emitAck(counterSocket, 'bar:chat', { text: 'blocked message' })).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(blockedChat).not.toHaveBeenCalled();
    await emitAck(otherCounterSocket, 'bar:block', { targetId: counterAuthorId });

    const counterCheers = once<{ userId: string }>(otherCounterSocket, 'bar:cheers');
    const cCheers = vi.fn(); c.on('bar:cheers', cCheers);
    expect((await emitAck(counterSocket, 'bar:cheers')).ok).toBe(true);
    expect((await counterCheers).userId).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(cCheers).not.toHaveBeenCalled();
  });

  it('restores one identity, then releases presence and seat after disconnect grace', async () => {
    const { client } = await setup();
    const observer = client(); const guest = client();
    await Promise.all([once(observer, 'connect'), once(guest, 'connect')]);
    await emitAck(observer, 'bar:join', profile('관찰자'));
    const joined = await emitAck<{ token: string; snapshot: BarSnapshot }>(guest, 'bar:join', profile('돌아올잔'));
    if (!joined.ok) throw new Error('join failed');
    const guestId = joined.data.snapshot.selfId!;
    await emitAck(guest, 'bar:seat', { seatId: 'table-1-1' });

    guest.disconnect();
    const restored = client(joined.data.token);
    const restoredSnapshot = once<BarSnapshot>(restored, 'bar:snapshot');
    await once(restored, 'connect');
    const snapshot = await restoredSnapshot;
    expect(snapshot.selfId).toBe(guestId);
    expect(snapshot.users.filter((user) => user.id === guestId)).toHaveLength(1);
    expect(snapshot.occupiedSeats['table-1-1']).toBe(guestId);

    const left = once<string>(observer, 'bar:user-left');
    restored.disconnect();
    expect(await left).toBe(guestId);
  });

  it('validates reports, rate limits chat and protects admin endpoints', async () => {
    const { app, client } = await setup();
    const a = client(); const b = client();
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    const aJoin = await emitAck<{ token: string; snapshot: BarSnapshot }>(a, 'bar:join', profile('신고자'));
    const bJoin = await emitAck<{ token: string; snapshot: BarSnapshot }>(b, 'bar:join', profile('대상자'));
    if (!aJoin.ok || !bJoin.ok) throw new Error('join failed');
    await emitAck(a, 'bar:seat', { seatId: 'counter-1' });
    const results = [];
    for (let index = 0; index < 6; index += 1) results.push(await emitAck(a, 'bar:chat', { text: `message ${index}` }));
    expect(results.at(-1)).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect((await emitAck(a, 'bar:report', { targetId: bJoin.data.snapshot.selfId, reason: 'spam', details: '반복 메시지' })).ok).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/admin/reports' })).statusCode).toBe(401);
    const authorized = await app.inject({ method: 'GET', url: '/api/admin/reports', headers: { authorization: 'Bearer test-admin' } });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json().reports).toHaveLength(1);
    const ban = await app.inject({ method: 'POST', url: `/api/admin/users/${bJoin.data.snapshot.selfId}/ban`, headers: { authorization: 'Bearer test-admin' }, payload: { reason: 'abuse', hours: 1 } });
    expect(ban.statusCode).toBe(200);
  });
});
