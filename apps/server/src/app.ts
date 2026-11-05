import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import {
  drinkSchema,
  joinSchema,
  messageSchema,
  moveSchema,
  reactionSchema,
  reportSchema,
  seatSchema,
  targetSchema,
  type Ack,
  type Channel,
  type ChatMessage,
  type ClientToServerEvents,
  type ServerToClientEvents
} from '@yeopjan/shared';
import { BarState } from './bar-state.js';
import { OperationsDatabase } from './database.js';
import { RateLimiter } from './rate-limiter.js';

interface SocketData { userId?: string }
type BarSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface AppOptions {
  databasePath?: string;
  allowedOrigins?: string[];
  adminToken?: string;
  disconnectGraceMs?: number;
  serveWeb?: boolean;
  logger?: boolean;
}

const ok = <T>(data?: T): Ack<T> => data === undefined ? { ok: true } as Ack<T> : { ok: true, data } as Ack<T>;
const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });
const roomName = (channel: Channel) => `channel:${channel}`;
const appRooms = ['channel:counter', 'channel:table-1', 'channel:table-2'];

const publicMessage = (error: unknown) => {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  const messages: Record<string, string> = {
    BAR_FULL: '오늘 바는 만석이에요.', SEAT_OCCUPIED: '방금 다른 손님이 앉았어요.', SEAT_NOT_FOUND: '찾을 수 없는 자리예요.',
    NOT_JOINED: '먼저 바에 입장해 주세요.', TARGET_NOT_FOUND: '해당 손님을 찾을 수 없어요.'
  };
  return fail(code, messages[code] ?? '요청을 처리하지 못했어요.');
};

export async function createApp(options: AppOptions = {}): Promise<{
  app: FastifyInstance;
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  state: BarState;
  close: () => Promise<void>;
}> {
  const app = Fastify({ logger: options.logger ?? false, logController: new LogController({ disableRequestLogging: true }), bodyLimit: 16 * 1024 });
  const state = new BarState();
  const database = new OperationsDatabase(options.databasePath ?? ':memory:');
  database.pruneReports();
  const reportPruneTimer = setInterval(() => database.pruneReports(), 24 * 60 * 60 * 1_000);
  reportPruneTimer.unref();
  const limiter = new RateLimiter();
  const allowedOrigins = options.allowedOrigins ?? ['http://localhost:3000', 'http://localhost:5173'];
  const disconnectGraceMs = options.disconnectGraceMs ?? 3_000;
  const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const channelPromptAt = new Map<Channel, number>();
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(app.server, {
    maxHttpBufferSize: 16 * 1024,
    perMessageDeflate: false,
    connectionStateRecovery: { maxDisconnectionDuration: disconnectGraceMs, skipMiddlewares: false },
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      callback(null, !origin || allowedOrigins.includes(origin));
    }
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.headers({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    return payload;
  });

  app.get('/health', async () => ({ ok: true }));
  app.get('/api/presence', async () => ({ count: state.connectedCount }));

  const authorized = (header: string | undefined) => {
    if (!limiter.allow('admin:global', 30, 60_000)) return false;
    if (!options.adminToken || !header?.startsWith('Bearer ')) return false;
    const supplied = Buffer.from(header.slice(7));
    const expected = Buffer.from(options.adminToken);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  };

  app.get('/api/admin/reports', async (request, reply) => {
    if (!authorized(request.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
    return { reports: database.listReports() };
  });

  app.post<{ Body: { sessionHash?: string; reason?: string; hours?: number } }>('/api/admin/bans', async (request, reply) => {
    if (!authorized(request.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
    const { sessionHash, reason, hours } = request.body ?? {};
    if (!sessionHash || !reason || typeof hours !== 'number' || hours <= 0 || hours > 24 * 365) return reply.code(400).send({ error: 'invalid_request' });
    database.ban(sessionHash, reason, Date.now() + hours * 60 * 60 * 1_000);
    return { ok: true };
  });

  app.delete<{ Params: { sessionHash: string } }>('/api/admin/bans/:sessionHash', async (request, reply) => {
    if (!authorized(request.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
    database.unban(request.params.sessionHash);
    return { ok: true };
  });

  app.post<{ Params: { userId: string }; Body: { reason?: string; hours?: number } }>('/api/admin/users/:userId/ban', async (request, reply) => {
    if (!authorized(request.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
    const { reason, hours } = request.body ?? {};
    const user = state.getPublicUser(request.params.userId);
    if (!user || !reason || typeof hours !== 'number' || hours <= 0 || hours > 24 * 365) return reply.code(400).send({ error: 'invalid_request' });
    database.ban(state.getSessionHash(user.id), reason, Date.now() + hours * 60 * 60 * 1_000);
    const socketId = state.getSocketId(user.id);
    state.remove(user.id);
    if (socketId) io.sockets.sockets.get(socketId)?.disconnect(true);
    io.emit('bar:user-left', user.id);
    emitPresence();
    return { ok: true };
  });

  const emitPresence = () => io.emit('bar:presence', state.connectedCount);
  const updateRooms = async (socket: BarSocket, channel: Channel | null) => {
    await Promise.all(appRooms.map((room) => socket.leave(room)));
    if (channel) await socket.join(roomName(channel));
  };
  const sendChannelEvent = <E extends 'bar:chat' | 'bar:cheers' | 'bar:reaction'>(channel: Channel, authorId: string, event: E, payload: Parameters<ServerToClientEvents[E]>[0]) => {
    for (const recipient of state.usersInChannel(channel)) {
      if (state.blocks(recipient.id, authorId)) continue;
      const socketId = state.getSocketId(recipient.id);
      if (socketId) (io.to(socketId).emit as any)(event, payload);
    }
  };
  const rate = (userId: string, action: string, limit: number, windowMs: number) =>
    limiter.allow(`${action}:${state.getSessionHash(userId)}`, limit, windowMs);

  io.on('connection', (socket) => {
    const reconnectToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
    if (reconnectToken) {
      if (database.isBanned(state.hashToken(reconnectToken))) {
        socket.emit('bar:notice', { code: 'BANNED', message: '이 세션은 입장할 수 없어요.' });
      } else {
        const restored = state.reconnect(reconnectToken, socket.id);
        if (restored) {
          socket.data.userId = restored.user.id;
          const timer = cleanupTimers.get(restored.user.id);
          if (timer) clearTimeout(timer);
          cleanupTimers.delete(restored.user.id);
          if (restored.replacedSocketId) io.sockets.sockets.get(restored.replacedSocketId)?.disconnect(true);
          void updateRooms(socket, restored.user.channel);
          socket.emit('bar:snapshot', state.snapshot(restored.user.id));
          socket.broadcast.emit('bar:user-updated', restored.user);
          emitPresence();
        } else {
          socket.emit('bar:notice', { code: 'SESSION_EXPIRED', message: '이전 방문 세션이 만료됐어요. 새 모습으로 다시 입장해 주세요.' });
        }
      }
    }

    socket.on('bar:join', (raw, callback) => {
      if (socket.data.userId) return callback(fail('ALREADY_JOINED', '이미 바에 입장했어요.'));
      const parsed = joinSchema.safeParse(raw);
      if (!parsed.success) return callback(fail('INVALID_JOIN', '입장 정보를 다시 확인해 주세요.'));
      const requestedToken = reconnectToken;
      if (requestedToken && database.isBanned(state.hashToken(requestedToken))) return callback(fail('BANNED', '이 세션은 입장할 수 없어요.'));
      try {
        const result = state.join(parsed.data, socket.id, requestedToken);
        socket.data.userId = result.user.id;
        if (result.replacedSocketId) io.sockets.sockets.get(result.replacedSocketId)?.disconnect(true);
        void updateRooms(socket, result.user.channel);
        callback(ok({ token: result.token, snapshot: state.snapshot(result.user.id) }));
        socket.broadcast.emit('bar:user-joined', result.user);
        emitPresence();
      } catch (error) { callback(publicMessage(error)); }
    });

    socket.on('bar:move', (raw, callback) => {
      const parsed = moveSchema.safeParse(raw);
      const userId = socket.data.userId;
      if (!parsed.success || !userId) return callback(fail('INVALID_MOVE', '이동할 수 없는 위치예요.'));
      if (!rate(userId, 'move', 10, 1_000)) return callback(fail('RATE_LIMITED', '조금 천천히 이동해 주세요.'));
      try {
        const user = state.move(userId, parsed.data.x, parsed.data.y);
        void updateRooms(socket, null);
        io.emit('bar:user-updated', user);
        callback(ok());
      } catch (error) { callback(publicMessage(error)); }
    });

    socket.on('bar:seat', (raw, callback) => {
      const parsed = seatSchema.safeParse(raw);
      const userId = socket.data.userId;
      if (!parsed.success || !userId) return callback(fail('INVALID_SEAT', '자리를 다시 선택해 주세요.'));
      if (!rate(userId, 'seat', 4, 5_000)) return callback(fail('RATE_LIMITED', '잠시 후 자리를 옮겨 주세요.'));
      try {
        const user = state.claimSeat(userId, parsed.data.seatId);
        void updateRooms(socket, user.channel);
        io.emit('bar:user-updated', user);
        if (user.channel && Date.now() - (channelPromptAt.get(user.channel) ?? 0) > 60_000) {
          channelPromptAt.set(user.channel, Date.now());
          const prompt: ChatMessage = {
            id: crypto.randomUUID(), authorId: 'bartender', author: '바텐더 (시스템)',
            text: '오늘 하루는 어땠어요?', channel: user.channel, system: true, createdAt: Date.now()
          };
          sendChannelEvent(user.channel, 'bartender', 'bar:chat', prompt);
        }
        callback(ok());
      } catch (error) { callback(publicMessage(error)); }
    });

    socket.on('bar:drink', (raw, callback) => {
      const parsed = drinkSchema.safeParse(raw);
      const userId = socket.data.userId;
      if (!parsed.success || !userId) return callback(fail('INVALID_DRINK', '음료를 다시 골라 주세요.'));
      if (!rate(userId, 'drink', 6, 5_000)) return callback(fail('RATE_LIMITED', '음료는 잠시 후 다시 바꿔 주세요.'));
      const user = state.setDrink(userId, parsed.data.drink);
      io.emit('bar:user-updated', user);
      callback(ok());
    });

    socket.on('bar:chat', (raw, callback) => {
      const parsed = messageSchema.safeParse(raw);
      const userId = socket.data.userId;
      const user = userId ? state.getPublicUser(userId) : null;
      if (!parsed.success || !userId || !user?.channel) return callback(fail('NO_CHAT_CHANNEL', '대화가 가능한 자리에 앉아 주세요.'));
      if (!rate(userId, 'chat', 5, 10_000)) return callback(fail('RATE_LIMITED', '메시지를 너무 빠르게 보내고 있어요.'));
      const message: ChatMessage = {
        id: crypto.randomUUID(), authorId: user.id, author: user.nickname, text: parsed.data.text,
        channel: user.channel, system: false, createdAt: Date.now()
      };
      sendChannelEvent(user.channel, userId, 'bar:chat', message);
      callback(ok());
    });

    socket.on('bar:cheers', (callback) => {
      const userId = socket.data.userId;
      const user = userId ? state.getPublicUser(userId) : null;
      if (!userId || !user?.channel) return callback(fail('NO_SOCIAL_CHANNEL', '대화 자리에서 건배할 수 있어요.'));
      if (!rate(userId, 'cheers', 1, 3_000)) return callback(fail('COOLDOWN', '잔을 잠시 내려두세요.'));
      sendChannelEvent(user.channel, userId, 'bar:cheers', { userId, channel: user.channel, at: Date.now() });
      callback(ok());
    });

    socket.on('bar:reaction', (raw, callback) => {
      const parsed = reactionSchema.safeParse(raw);
      const userId = socket.data.userId;
      const user = userId ? state.getPublicUser(userId) : null;
      if (!parsed.success || !userId || !user?.channel) return callback(fail('NO_SOCIAL_CHANNEL', '대화 자리에서 반응을 보낼 수 있어요.'));
      if (!rate(userId, 'reaction', 4, 5_000)) return callback(fail('RATE_LIMITED', '반응을 조금 천천히 보내 주세요.'));
      sendChannelEvent(user.channel, userId, 'bar:reaction', { userId, reaction: parsed.data.reaction, at: Date.now() });
      callback(ok());
    });

    socket.on('bar:block', (raw, callback) => {
      const parsed = targetSchema.safeParse(raw);
      const userId = socket.data.userId;
      if (!parsed.success || !userId) return callback(fail('INVALID_TARGET', '대상을 찾을 수 없어요.'));
      if (!rate(userId, 'block', 6, 10_000)) return callback(fail('RATE_LIMITED', '차단 설정은 잠시 후 다시 바꿔 주세요.'));
      try { callback(ok({ blocked: state.toggleBlock(userId, parsed.data.targetId) })); }
      catch (error) { callback(publicMessage(error)); }
    });

    socket.on('bar:report', (raw, callback) => {
      const parsed = reportSchema.safeParse(raw);
      const userId = socket.data.userId;
      if (!parsed.success || !userId || !state.getPublicUser(parsed.data.targetId)) return callback(fail('INVALID_REPORT', '신고 내용을 다시 확인해 주세요.'));
      if (!rate(userId, 'report', 3, 60 * 60 * 1_000)) return callback(fail('RATE_LIMITED', '신고 횟수 제한에 도달했어요.'));
      database.addReport({ reporterHash: state.getSessionHash(userId), targetId: parsed.data.targetId, reason: parsed.data.reason, details: parsed.data.details, createdAt: Date.now() });
      callback(ok());
    });

    socket.on('bar:leave', (callback) => {
      const userId = socket.data.userId;
      if (userId) {
        state.remove(userId);
        delete socket.data.userId;
        io.emit('bar:user-left', userId);
        emitPresence();
      }
      callback(ok());
    });

    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (!userId || state.getSocketId(userId) !== socket.id) return;
      const user = state.markDisconnected(userId);
      if (!user) return;
      io.emit('bar:user-updated', user);
      emitPresence();
      const timer = setTimeout(() => {
        if (state.getPublicUser(userId)?.connected) return;
        state.remove(userId);
        cleanupTimers.delete(userId);
        io.emit('bar:user-left', userId);
      }, disconnectGraceMs);
      cleanupTimers.set(userId, timer);
    });
  });

  if (options.serveWeb) {
    const webRoot = process.env.WEB_DIST
      ? resolve(process.cwd(), process.env.WEB_DIST)
      : fileURLToPath(new URL('../../web/dist', import.meta.url));
    if (existsSync(webRoot)) {
      const indexHtml = readFileSync(resolve(webRoot, 'index.html'), 'utf8');
      const assetRoot = resolve(webRoot, 'assets');
      const contentTypes: Record<string, string> = {
        '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml'
      };
      app.get<{ Params: { file: string } }>('/assets/:file', async (request, reply) => {
        const file = request.params.file;
        const path = resolve(assetRoot, file);
        if (!/^[A-Za-z0-9._-]+$/.test(file) || !path.startsWith(`${assetRoot}${sep}`) || !existsSync(path)) return reply.code(404).send({ error: 'not_found' });
        return reply.header('Cache-Control', 'public, max-age=31536000, immutable').type(contentTypes[extname(file)] ?? 'application/octet-stream').send(createReadStream(path));
      });
      app.get('/', async (_request, reply) => reply.type('text/html; charset=utf-8').send(indexHtml));
      app.get('/*', async (_request, reply) => reply.type('text/html; charset=utf-8').send(indexHtml));
    }
  }

  const close = async () => {
    clearInterval(reportPruneTimer);
    for (const timer of cleanupTimers.values()) clearTimeout(timer);
    await new Promise<void>((resolveClose) => io.close(() => resolveClose()));
    database.close();
    await app.close();
  };

  return { app, io, state, close };
}
