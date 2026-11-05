import { describe, expect, it } from 'vitest';
import { drinkEmojis, drinks, joinSchema, messageSchema, seats } from './index.js';

describe('shared validation', () => {
  it('normalizes a valid guest and rejects underage confirmation omission', () => {
    expect(joinSchema.parse({ nickname: '  밤   산책  ', avatar: 'amber', mood: null, adultConfirmed: true }).nickname).toBe('밤 산책');
    expect(() => joinSchema.parse({ nickname: '밤 산책', avatar: 'amber', mood: null, adultConfirmed: false })).toThrow();
  });

  it('limits messages and keeps seat identifiers unique', () => {
    expect(() => messageSchema.parse({ text: 'a'.repeat(301) })).toThrow();
    expect(new Set(seats.map((seat) => seat.id)).size).toBe(seats.length);
  });

  it('gives every drink a visible emoji', () => {
    expect(Object.keys(drinkEmojis).sort()).toEqual([...drinks].sort());
    expect(new Set(Object.values(drinkEmojis)).size).toBe(drinks.length);
  });
});
