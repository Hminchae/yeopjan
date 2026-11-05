import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  seats,
  type AvatarStyle,
  type BarSnapshot,
  type Channel,
  type Drink,
  type Mood,
  type PublicUser
} from '@yeopjan/shared';

interface InternalUser extends PublicUser {
  sessionHash: string;
  socketId: string;
  blocked: Set<string>;
}

export interface JoinInput {
  nickname: string;
  avatar: AvatarStyle;
  mood: Mood | null;
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export class BarState {
  private readonly users = new Map<string, InternalUser>();
  private readonly sessions = new Map<string, string>();
  private readonly occupiedSeats = new Map<string, string>();

  readonly capacity = 24;

  hashToken(token: string): string {
    return tokenHash(token);
  }

  join(input: JoinInput, socketId: string, requestedToken?: string): { user: PublicUser; token: string; replacedSocketId?: string } {
    if (requestedToken) {
      const existingId = this.sessions.get(tokenHash(requestedToken));
      const existing = existingId ? this.users.get(existingId) : undefined;
      if (existing) {
        const replacedSocketId = existing.socketId === socketId ? undefined : existing.socketId;
        existing.socketId = socketId;
        existing.connected = true;
        existing.nickname = input.nickname;
        existing.avatar = input.avatar;
        existing.mood = input.mood;
        return { user: this.publicUser(existing), token: requestedToken, ...(replacedSocketId ? { replacedSocketId } : {}) };
      }
    }

    if (this.connectedCount >= this.capacity) throw new Error('BAR_FULL');
    const token = randomBytes(32).toString('base64url');
    const user: InternalUser = {
      id: randomUUID(),
      nickname: input.nickname,
      avatar: input.avatar,
      mood: input.mood,
      x: 90,
      y: 88,
      seatId: null,
      drink: 'sparkling-water',
      channel: null,
      connected: true,
      sessionHash: tokenHash(token),
      socketId,
      blocked: new Set()
    };
    this.users.set(user.id, user);
    this.sessions.set(user.sessionHash, user.id);
    return { user: this.publicUser(user), token };
  }

  reconnect(token: string, socketId: string): { user: PublicUser; replacedSocketId?: string } | null {
    const id = this.sessions.get(tokenHash(token));
    const user = id ? this.users.get(id) : undefined;
    if (!user) return null;
    const replacedSocketId = user.socketId === socketId ? undefined : user.socketId;
    user.socketId = socketId;
    user.connected = true;
    return { user: this.publicUser(user), ...(replacedSocketId ? { replacedSocketId } : {}) };
  }

  markDisconnected(userId: string): PublicUser | null {
    const user = this.users.get(userId);
    if (!user) return null;
    user.connected = false;
    return this.publicUser(user);
  }

  remove(userId: string): PublicUser | null {
    const user = this.users.get(userId);
    if (!user) return null;
    if (user.seatId) this.occupiedSeats.delete(user.seatId);
    this.sessions.delete(user.sessionHash);
    this.users.delete(userId);
    return this.publicUser(user);
  }

  move(userId: string, x: number, y: number): PublicUser {
    const user = this.requireUser(userId);
    if (user.seatId) this.occupiedSeats.delete(user.seatId);
    user.seatId = null;
    user.channel = null;
    user.x = x;
    user.y = y;
    return this.publicUser(user);
  }

  claimSeat(userId: string, seatId: string | null): PublicUser {
    const user = this.requireUser(userId);
    if (seatId === null) return this.move(userId, user.x, user.y);
    const seat = seats.find((candidate) => candidate.id === seatId);
    if (!seat) throw new Error('SEAT_NOT_FOUND');
    const occupant = this.occupiedSeats.get(seatId);
    if (occupant && occupant !== userId) throw new Error('SEAT_OCCUPIED');
    if (user.seatId && user.seatId !== seatId) this.occupiedSeats.delete(user.seatId);
    this.occupiedSeats.set(seatId, userId);
    user.seatId = seatId;
    user.channel = seat.channel;
    user.x = seat.x;
    user.y = seat.y;
    return this.publicUser(user);
  }

  setDrink(userId: string, drink: Drink): PublicUser {
    const user = this.requireUser(userId);
    user.drink = drink;
    return this.publicUser(user);
  }

  toggleBlock(userId: string, targetId: string): boolean {
    if (userId === targetId || !this.users.has(targetId)) throw new Error('TARGET_NOT_FOUND');
    const user = this.requireUser(userId);
    if (user.blocked.has(targetId)) {
      user.blocked.delete(targetId);
      return false;
    }
    user.blocked.add(targetId);
    return true;
  }

  blocks(userId: string, targetId: string): boolean {
    return this.users.get(userId)?.blocked.has(targetId) ?? false;
  }

  getPublicUser(userId: string): PublicUser | null {
    const user = this.users.get(userId);
    return user ? this.publicUser(user) : null;
  }

  getSocketId(userId: string): string | null {
    return this.users.get(userId)?.socketId ?? null;
  }

  getSessionHash(userId: string): string {
    return this.requireUser(userId).sessionHash;
  }

  usersInChannel(channel: Channel): PublicUser[] {
    return [...this.users.values()].filter((user) => user.connected && user.channel === channel).map((user) => this.publicUser(user));
  }

  snapshot(selfId: string | null = null): BarSnapshot {
    return {
      selfId,
      users: [...this.users.values()].map((user) => this.publicUser(user)),
      occupiedSeats: Object.fromEntries(this.occupiedSeats),
      connectedCount: this.connectedCount
    };
  }

  get connectedCount(): number {
    return [...this.users.values()].filter((user) => user.connected).length;
  }

  private requireUser(userId: string): InternalUser {
    const user = this.users.get(userId);
    if (!user) throw new Error('NOT_JOINED');
    return user;
  }

  private publicUser(user: InternalUser): PublicUser {
    return {
      id: user.id, nickname: user.nickname, avatar: user.avatar, mood: user.mood,
      x: user.x, y: user.y, seatId: user.seatId, drink: user.drink,
      channel: user.channel, connected: user.connected
    };
  }
}
