import { describe, expect, it } from 'vitest';
import { BarState } from './bar-state.js';

const guest = (nickname: string) => ({ nickname, avatar: 'amber' as const, mood: null });

describe('BarState', () => {
  it('assigns a contested seat to only one user', () => {
    const state = new BarState();
    const a = state.join(guest('밤산책'), 'socket-a').user;
    const b = state.join(guest('느린파도'), 'socket-b').user;
    expect(state.claimSeat(a.id, 'counter-1').seatId).toBe('counter-1');
    expect(() => state.claimSeat(b.id, 'counter-1')).toThrow('SEAT_OCCUPIED');
  });

  it('releases a seat on removal and restores one user on reconnect', () => {
    const state = new BarState();
    const joined = state.join(guest('밤산책'), 'socket-a');
    state.claimSeat(joined.user.id, 'table-1-1');
    state.markDisconnected(joined.user.id);
    const restored = state.reconnect(joined.token, 'socket-b');
    expect(restored?.user.seatId).toBe('table-1-1');
    expect(state.connectedCount).toBe(1);
    state.remove(joined.user.id);
    expect(state.snapshot().occupiedSeats).toEqual({});
  });

  it('never exposes session or socket identifiers', () => {
    const state = new BarState();
    const joined = state.join(guest('고요한잔'), 'private-socket');
    expect(JSON.stringify(state.snapshot(joined.user.id))).not.toContain('private-socket');
    expect(JSON.stringify(joined.user)).not.toContain(joined.token);
  });
});
