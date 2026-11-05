import { z } from 'zod';

export const moods = ['chat', 'quiet', 'off-work', 'good-night'] as const;
export const avatars = ['amber', 'burgundy', 'navy', 'sage', 'plum', 'copper'] as const;
export const drinks = ['beer', 'wine', 'highball', 'whiskey', 'sparkling-water', 'mocktail'] as const;
export const reactions = ['wave', 'cheers', 'heart', 'clap', 'moon'] as const;
export const reportReasons = ['harassment', 'hate', 'sexual', 'spam', 'other'] as const;

export type Mood = (typeof moods)[number];
export type AvatarStyle = (typeof avatars)[number];
export type Drink = (typeof drinks)[number];
export type Reaction = (typeof reactions)[number];
export type Channel = 'counter' | 'table-1' | 'table-2';

export interface Seat {
  id: string;
  label: string;
  area: 'counter' | 'window' | 'table-1' | 'table-2';
  channel: Channel | null;
  x: number;
  y: number;
}

export const seats: readonly Seat[] = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `counter-${index + 1}`,
    label: `바 카운터 ${index + 1}번 좌석`,
    area: 'counter' as const,
    channel: 'counter' as const,
    x: 25 + index * 10,
    y: 47
  })),
  { id: 'window-1', label: '창가 1번 좌석', area: 'window', channel: null, x: 15, y: 27 },
  { id: 'window-2', label: '창가 2번 좌석', area: 'window', channel: null, x: 25, y: 27 },
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `table-1-${index + 1}`,
    label: `작은 테이블 하나 ${index + 1}번 좌석`,
    area: 'table-1' as const,
    channel: 'table-1' as const,
    x: 25 + (index % 2) * 12,
    y: 70 + Math.floor(index / 2) * 12
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `table-2-${index + 1}`,
    label: `작은 테이블 둘 ${index + 1}번 좌석`,
    area: 'table-2' as const,
    channel: 'table-2' as const,
    x: 65 + (index % 2) * 12,
    y: 70 + Math.floor(index / 2) * 12
  }))
] satisfies Seat[];

export const nicknameSchema = z.string().trim().min(2).max(16)
  .transform((value) => Array.from(value).filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
  }).join('').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(2).max(16));

export const joinSchema = z.object({
  nickname: nicknameSchema,
  avatar: z.enum(avatars),
  mood: z.enum(moods).nullable(),
  adultConfirmed: z.literal(true)
}).strict();

export const moveSchema = z.object({ x: z.number().min(4).max(96), y: z.number().min(12).max(92) }).strict();
export const seatSchema = z.object({ seatId: z.string().max(32).nullable() }).strict();
export const drinkSchema = z.object({ drink: z.enum(drinks) }).strict();
export const messageSchema = z.object({ text: z.string().trim().min(1).max(300) }).strict();
export const reactionSchema = z.object({ reaction: z.enum(reactions) }).strict();
export const targetSchema = z.object({ targetId: z.string().uuid() }).strict();
export const reportSchema = targetSchema.extend({
  reason: z.enum(reportReasons),
  details: z.string().trim().max(300).default('')
}).strict();

export interface PublicUser {
  id: string;
  nickname: string;
  avatar: AvatarStyle;
  mood: Mood | null;
  x: number;
  y: number;
  seatId: string | null;
  drink: Drink;
  channel: Channel | null;
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string | 'bartender';
  author: string;
  text: string;
  channel: Channel;
  system: boolean;
  createdAt: number;
}

export interface BarSnapshot {
  selfId: string | null;
  users: PublicUser[];
  occupiedSeats: Record<string, string>;
  connectedCount: number;
}

export type Ack<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; code: string; message: string }
  : { ok: true; data: T } | { ok: false; code: string; message: string };

export interface ClientToServerEvents {
  'bar:join': (payload: z.input<typeof joinSchema>, callback: (ack: Ack<{ token: string; snapshot: BarSnapshot }>) => void) => void;
  'bar:move': (payload: z.input<typeof moveSchema>, callback: (ack: Ack) => void) => void;
  'bar:seat': (payload: z.input<typeof seatSchema>, callback: (ack: Ack) => void) => void;
  'bar:drink': (payload: z.input<typeof drinkSchema>, callback: (ack: Ack) => void) => void;
  'bar:chat': (payload: z.input<typeof messageSchema>, callback: (ack: Ack) => void) => void;
  'bar:cheers': (callback: (ack: Ack) => void) => void;
  'bar:reaction': (payload: z.input<typeof reactionSchema>, callback: (ack: Ack) => void) => void;
  'bar:block': (payload: z.input<typeof targetSchema>, callback: (ack: Ack<{ blocked: boolean }>) => void) => void;
  'bar:report': (payload: z.input<typeof reportSchema>, callback: (ack: Ack) => void) => void;
  'bar:leave': (callback: (ack: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'bar:snapshot': (snapshot: BarSnapshot) => void;
  'bar:presence': (count: number) => void;
  'bar:user-joined': (user: PublicUser) => void;
  'bar:user-updated': (user: PublicUser) => void;
  'bar:user-left': (userId: string) => void;
  'bar:chat': (message: ChatMessage) => void;
  'bar:cheers': (payload: { userId: string; channel: Channel; at: number }) => void;
  'bar:reaction': (payload: { userId: string; reaction: Reaction; at: number }) => void;
  'bar:notice': (payload: { code: string; message: string }) => void;
}

export const moodLabels: Record<Mood, string> = {
  chat: '수다 떨래요', quiet: '그냥 쉬고 싶어요', 'off-work': '퇴근했어요', 'good-night': '기분 좋은 밤'
};
export const drinkLabels: Record<Drink, string> = {
  beer: '맥주', wine: '와인', highball: '하이볼', whiskey: '위스키', 'sparkling-water': '탄산수', mocktail: '무알코올 칵테일'
};
export const drinkEmojis: Record<Drink, string> = {
  beer: '🍺', wine: '🍷', highball: '🍹', whiskey: '🥃', 'sparkling-water': '🥤', mocktail: '🍸'
};
export const reactionLabels: Record<Reaction, string> = {
  wave: '👋', cheers: '🍻', heart: '❤️', clap: '👏', moon: '🌙'
};
