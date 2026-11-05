import { describe, expect, it } from 'vitest';
import { OperationsDatabase } from './database.js';

describe('OperationsDatabase', () => {
  it('stores minimal reports, expires old reports and bans', () => {
    const database = new OperationsDatabase(':memory:');
    database.addReport({ reporterHash: 'hidden', targetId: 'target', reason: 'spam', details: '반복 메시지', createdAt: 1_000 });
    expect(database.listReports()).toHaveLength(1);
    expect(database.pruneReports(3_000, 1_000)).toBe(1);
    database.ban('hash', 'abuse', 5_000);
    expect(database.isBanned('hash', 4_000)).toBe(true);
    expect(database.isBanned('hash', 6_000)).toBe(false);
    database.close();
  });
});
