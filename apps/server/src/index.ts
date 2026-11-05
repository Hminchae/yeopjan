import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:5173').split(',').map((origin) => origin.trim());
const { app } = await createApp({
  databasePath: process.env.DATABASE_PATH ?? './data/yeopjan.db',
  allowedOrigins,
  ...(process.env.ADMIN_TOKEN ? { adminToken: process.env.ADMIN_TOKEN } : {}),
  disconnectGraceMs: Number(process.env.DISCONNECT_GRACE_MS ?? 3_000),
  serveWeb: process.env.NODE_ENV === 'production',
  logger: true
});

await app.listen({ port, host });
