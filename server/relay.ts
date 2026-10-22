import { normalizeName } from '../shared/names.js';
import { originAllowed, type OriginPolicy } from './origins.js';
import { normalizeContent } from '../shared/content.js';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import {
  LIMITS,
  normalizeCode,
  type Ack,
  type ClientEvents,
  type FileMeta,
  type Member,
  type Room,
  type ServerEvents,
} from '../shared/protocol.js';

interface LiveRoom {
  code: string;
  mode: Room['mode'];
  members: Map<string, Member>;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}
interface Transfer {
  file: FileMeta;
  room: string;
  bytes: number;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}
interface SocketData {
  code?: string;
  cancelTransfers?: () => void;
}
/** In-memory membership and transfer metadata only. Content is relayed, never retained. */
export function createRelay(
  http: HttpServer,
  policy: OriginPolicy = { allowedOrigins: [], production: false },
) {
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>(http, {
    maxHttpBufferSize: LIMITS.chunkBytes + 4096,
    // Check both long-polling requests and WebSocket upgrades against the same allowlist.
    cors: {
      origin: policy.allowedOrigins.length ? policy.allowedOrigins : false,
      methods: ['GET', 'POST'],
    },
    allowRequest: (req, done) => done(null, originAllowed(req.headers.origin, req, policy)),
  });
  const rooms = new Map<string, LiveRoom>();
  const publicRoom = (room: LiveRoom): Room => ({
    code: room.code,
    mode: room.mode,
    members: [...room.members.values()],
    expiresAt: room.expiresAt,
  });
  const destroyRoom = (code: string, reason: string) => {
    const room = rooms.get(code);
    if (!room) return;
    clearTimeout(room.timer);
    io.to(code).emit('room:ended', reason);
    for (const id of room.members.keys()) {
      const client = io.sockets.sockets.get(id);
      if (client) {
        client.data.cancelTransfers?.();
        client.data.code = undefined;
        void client.leave(code);
        client.emit('room:members', []);
      }
    }
    rooms.delete(code);
  };
  io.on('connection', (socket) => {
    const transfers = new Map<string, Transfer>();
    let windowStart = Date.now(),
      eventCount = 0,
      roomActions = 0;
    const allowed = <T>(ack: Ack<T>, roomAction = false) => {
      if (Date.now() - windowStart > 10_000) {
        windowStart = Date.now();
        eventCount = 0;
        roomActions = 0;
      }
      if (++eventCount > 600 || (roomAction && ++roomActions > 10)) {
        ack({ ok: false, error: 'A little too fast. Please try again in a few seconds.' });
        return false;
      }
      return true;
    };
    const getRoom = () => rooms.get(socket.data.code as string);
    const cancel = (id: string) => {
      const transfer = transfers.get(id);
      if (!transfer) return;
      clearTimeout(transfer.timer);
      io.to(transfer.room).emit('file:cancel', id);
      transfers.delete(id);
    };
    socket.data.cancelTransfers = () => {
      for (const id of transfers.keys()) cancel(id);
    };
    const leave = () => {
      for (const id of transfers.keys()) cancel(id);
      const room = getRoom();
      if (!room) return;
      room.members.delete(socket.id);
      void socket.leave(room.code);
      socket.data.code = undefined;
      if (!room.members.size) {
        clearTimeout(room.timer);
        rooms.delete(room.code);
      } else io.to(room.code).emit('room:members', [...room.members.values()]);
    };
    socket.on('room:create', (input, ack) => {
      if (typeof ack !== 'function' || !allowed(ack, true)) return;
      const name = normalizeName(input?.name);
      if (!name) return ack({ ok: false, error: 'Enter a name between 1 and 32 characters.' });
      if (!input || !['pair', 'team'].includes(input.mode))
        return ack({ ok: false, error: 'Choose a valid tunnel type.' });
      leave();
      let code: string;
      do {
        code = randomBytes(6).toString('hex');
      } while (rooms.has(code));
      const expiresAt = Date.now() + LIMITS.roomMs;
      const room: LiveRoom = {
        code,
        mode: input.mode,
        expiresAt,
        members: new Map(),
        timer: setTimeout(
          () => destroyRoom(code, 'This tunnel reached its two-hour limit.'),
          LIMITS.roomMs,
        ),
      };
      room.timer.unref();
      room.members.set(socket.id, { id: socket.id, name });
      rooms.set(code, room);
      socket.data.code = code;
      void socket.join(code);
      ack({ ok: true, data: publicRoom(room) });
    });
    socket.on('room:join', (input, ack) => {
      if (typeof ack !== 'function' || !allowed(ack, true)) return;
      const name = normalizeName(input?.name);
      if (!name) return ack({ ok: false, error: 'Enter a name between 1 and 32 characters.' });
      const code = typeof input?.code === 'string' ? normalizeCode(input.code) : '';
      const room = rooms.get(code);
      if (!room)
        return ack({
          ok: false,
          error: 'This tunnel is closed or the code is incorrect. Ask your teammate for a new one.',
        });
      if (getRoom()?.code === code) return ack({ ok: true, data: publicRoom(room) });
      if (room.members.size >= (room.mode === 'pair' ? 2 : LIMITS.members))
        return ack({ ok: false, error: 'This tunnel is full. Try a team tunnel for more people.' });
      leave();
      room.members.set(socket.id, { id: socket.id, name });
      socket.data.code = code;
      void socket.join(code);
      ack({ ok: true, data: publicRoom(room) });
      io.to(code).emit('room:members', [...room.members.values()]);
    });
    socket.on('room:leave', (ack) => {
      leave();
      if (typeof ack === 'function') ack({ ok: true, data: undefined });
    });
    socket.on('room:end', (ack) => {
      if (typeof ack !== 'function') return;
      const room = getRoom();
      if (room)
        destroyRoom(room.code, 'A participant ended this tunnel. Its contents have been cleared.');
      for (const id of transfers.keys()) cancel(id);
      ack({ ok: true, data: undefined });
    });
    socket.on('content:text', (content, ack) => {
      if (typeof ack !== 'function' || !allowed(ack)) return;
      const room = getRoom();
      if (!room) return ack({ ok: false, error: 'Join a tunnel first.' });
      if (room.members.size < 2)
        return ack({ ok: false, error: 'Wait for a teammate to join before sharing.' });
      if (
        !content ||
        !['text', 'code'].includes(content.kind) ||
        typeof content.text !== 'string' ||
        !content.text.trim() ||
        content.text.length > LIMITS.textLength
      )
        return ack({ ok: false, error: 'Messages must contain between 1 and 16,000 characters.' });
      const normalized = normalizeContent(content);
      if (!normalized) return ack({ ok: false, error: 'Invalid reply or code language.' });
      const message = {
        id: randomUUID(),
        sender: room.members.get(socket.id)!,
        at: Date.now(),
        content: normalized,
      };
      socket.to(room.code).emit('content:text', message);
      ack({ ok: true, data: message });
    });
    socket.on('file:start', (file, ack) => {
      if (typeof ack !== 'function' || !allowed(ack)) return;
      const room = getRoom();
      if (!room || room.members.size < 2)
        return ack({ ok: false, error: 'Wait for a teammate to join before sharing.' });
      if (
        !file ||
        typeof file.id !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(file.id) ||
        typeof file.name !== 'string' ||
        !file.name.length ||
        file.name.length > 255 ||
        typeof file.mime !== 'string' ||
        file.mime.length > 100 ||
        !Number.isInteger(file.size) ||
        file.size < 0 ||
        file.size > LIMITS.fileBytes ||
        transfers.size >= 2 ||
        transfers.has(file.id)
      )
        return ack({
          ok: false,
          error: 'Invalid file, or too many active transfers. Files can be up to 20 MB.',
        });
      const meta = { id: file.id, name: file.name, size: file.size, mime: file.mime };
      const timer = setTimeout(() => cancel(file.id), 60_000);
      timer.unref();
      transfers.set(file.id, { file: meta, room: room.code, bytes: 0, index: 0, timer });
      socket
        .to(room.code)
        .emit('file:start', { sender: room.members.get(socket.id)!, file: meta, at: Date.now() });
      ack({ ok: true, data: undefined });
    });
    socket.on('file:chunk', (chunk, ack) => {
      if (typeof ack !== 'function' || !allowed(ack)) return;
      const transfer = transfers.get(chunk?.id);
      const data: unknown = chunk?.data;
      if (
        !transfer ||
        !getRoom() ||
        transfer.room !== socket.data.code ||
        !Buffer.isBuffer(data) ||
        data.byteLength > LIMITS.chunkBytes ||
        data.byteLength === 0 ||
        chunk.index !== transfer.index ||
        transfer.bytes + data.byteLength > transfer.file.size
      ) {
        if (chunk?.id) cancel(chunk.id);
        return ack({
          ok: false,
          error: 'The transfer was interrupted. Please try sending the file again.',
        });
      }
      transfer.bytes += data.byteLength;
      transfer.index++;
      transfer.timer.refresh();
      socket.to(transfer.room).emit('file:chunk', chunk);
      ack({ ok: true, data: undefined });
    });
    socket.on('file:complete', (id, ack) => {
      if (typeof ack !== 'function') return;
      const transfer = transfers.get(id);
      if (
        !transfer ||
        !getRoom() ||
        transfer.room !== socket.data.code ||
        transfer.bytes !== transfer.file.size
      )
        return ack({ ok: false, error: 'The file did not finish transferring.' });
      clearTimeout(transfer.timer);
      transfers.delete(id);
      socket.to(transfer.room).emit('file:complete', id);
      ack({ ok: true, data: undefined });
    });
    socket.on('file:cancel', cancel);
    socket.on('disconnect', leave);
  });
  io.on('close', () => {
    for (const room of rooms.values()) clearTimeout(room.timer);
    rooms.clear();
  });
  return io;
}
