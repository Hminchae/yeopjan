import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface ReportRecord {
  reporterHash: string;
  targetId: string;
  reason: string;
  details: string;
  createdAt: number;
}

export class OperationsDatabase {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_hash TEXT NOT NULL,
        target_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bans (
        session_hash TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reports_created_at ON reports(created_at);
    `);
  }

  addReport(report: ReportRecord): void {
    this.db.prepare('INSERT INTO reports (reporter_hash, target_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(report.reporterHash, report.targetId, report.reason, report.details, report.createdAt);
  }

  listReports(limit = 100): unknown[] {
    return this.db.prepare('SELECT id, target_id AS targetId, reason, details, created_at AS createdAt FROM reports ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  ban(sessionHash: string, reason: string, expiresAt: number): void {
    this.db.prepare('INSERT OR REPLACE INTO bans (session_hash, reason, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(sessionHash, reason, expiresAt, Date.now());
  }

  unban(sessionHash: string): void {
    this.db.prepare('DELETE FROM bans WHERE session_hash = ?').run(sessionHash);
  }

  isBanned(sessionHash: string, now = Date.now()): boolean {
    this.db.prepare('DELETE FROM bans WHERE expires_at <= ?').run(now);
    return Boolean(this.db.prepare('SELECT 1 FROM bans WHERE session_hash = ? AND expires_at > ?').get(sessionHash, now));
  }

  pruneReports(now = Date.now(), retentionMs = 30 * 24 * 60 * 60 * 1_000): number {
    return Number(this.db.prepare('DELETE FROM reports WHERE created_at < ?').run(now - retentionMs).changes);
  }

  close(): void {
    this.db.close();
  }
}
