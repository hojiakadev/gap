import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io as connect, type Socket } from 'socket.io-client';
import { createRelay } from '../server/relay.js';
import { LIMITS, type ClientEvents, type ServerEvents } from '../shared/protocol.js';
const http = createServer();
const relay = createRelay(http);
let url: string;
const clients: Socket<ServerEvents, ClientEvents>[] = [];
before(async () => {
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  url = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  for (const client of clients) client.disconnect();
  await new Promise<void>((resolve) => relay.close(() => resolve()));
});
async function client() {
  const socket: Socket<ServerEvents, ClientEvents> = connect(url, {
    transports: ['websocket'],
    forceNew: true,
  });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}
function event<T>(
  socket: Socket<ServerEvents, ClientEvents>,
  name: keyof ServerEvents,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 2000);
    // Tests intentionally abstract event payload types for a one-shot listener.
    (socket as unknown as { once: (name: string, handler: (data: T) => void) => void }).once(
      name,
      (data) => {
        clearTimeout(timer);
        resolve(data);
      },
    );
  });
}
test('pair rooms enforce capacity, deliver text, and delete immediately after everyone leaves', async () => {
  const a = await client(),
    b = await client(),
    c = await client();
  const created = await a.timeout(2000).emitWithAck('room:create', { name: 'Alex', mode: 'pair' });
  assert.ok(created.ok);
  const code = created.data.code;
  assert.match(code, /^[a-f0-9]{12}$/);
  const alone = await a.timeout(2000).emitWithAck('content:text', { kind: 'text', text: 'Hello' });
  assert.equal(alone.ok, false);
  const joined = await b.timeout(2000).emitWithAck('room:join', { name: 'Bea', code });
  assert.ok(joined.ok);
  assert.equal(joined.data.members.length, 2);
  const full = await c.timeout(2000).emitWithAck('room:join', { name: 'Chris', code });
  assert.equal(full.ok, false);
  const incoming = event<{ content: { text: string }; sender: { name: string } }>(
    b,
    'content:text',
  );
  const sent = await a
    .timeout(2000)
    .emitWithAck('content:text', { kind: 'text', text: 'A real relay message' });
  assert.ok(sent.ok);
  const received = await incoming;
  assert.equal(received.content.text, 'A real relay message');
  assert.equal(received.sender.name, 'Alex');
  await a.timeout(2000).emitWithAck('room:leave');
  await b.timeout(2000).emitWithAck('room:leave');
  const dead = await c.timeout(2000).emitWithAck('room:join', { name: 'Chris', code });
  assert.equal(dead.ok, false);
});
test('binary files are relayed in order and invalid or oversized transfers are rejected', async () => {
  const a = await client(),
    b = await client();
  const room = await a.timeout(2000).emitWithAck('room:create', { name: 'A', mode: 'team' });
  assert.ok(room.ok);
  await b.timeout(2000).emitWithAck('room:join', { name: 'B', code: room.data.code });
  const oversized = await a.timeout(2000).emitWithAck('file:start', {
    id: randomUUID(),
    name: 'huge.bin',
    size: LIMITS.fileBytes + 1,
    mime: '',
  });
  assert.equal(oversized.ok, false);
  const id = randomUUID(),
    bytes = new TextEncoder().encode('hello file');
  const started = event<{ file: { id: string } }>(b, 'file:start');
  const start = await a.timeout(2000).emitWithAck('file:start', {
    id,
    name: 'hello.txt',
    size: bytes.byteLength,
    mime: 'text/plain',
  });
  assert.ok(start.ok);
  assert.equal((await started).file.id, id);
  const chunked = event<{ data: ArrayBuffer }>(b, 'file:chunk');
  const chunk = await a
    .timeout(2000)
    .emitWithAck('file:chunk', { id, index: 0, data: bytes.buffer });
  assert.ok(chunk.ok);
  assert.equal(new TextDecoder().decode((await chunked).data), 'hello file');
  const completed = event<string>(b, 'file:complete');
  const complete = await a.timeout(2000).emitWithAck('file:complete', id);
  assert.ok(complete.ok);
  assert.equal(await completed, id);
  const invalid = randomUUID();
  await a
    .timeout(2000)
    .emitWithAck('file:start', { id: invalid, name: 'bad.txt', size: 4, mime: '' });
  const bad = await a
    .timeout(2000)
    .emitWithAck('file:chunk', { id: invalid, index: 1, data: new ArrayBuffer(4) });
  assert.equal(bad.ok, false);
  await a.timeout(2000).emitWithAck('room:end');
});
test('ending a tunnel clears membership for every client and prevents reuse', async () => {
  const a = await client(),
    b = await client();
  const room = await a.timeout(2000).emitWithAck('room:create', { name: 'A', mode: 'team' });
  assert.ok(room.ok);
  await b.timeout(2000).emitWithAck('room:join', { name: 'B', code: room.data.code });
  const ended = event<string>(b, 'room:ended');
  await a.timeout(2000).emitWithAck('room:end');
  assert.match(await ended, /ended/);
  const text = await b
    .timeout(2000)
    .emitWithAck('content:text', { kind: 'text', text: 'After close' });
  assert.equal(text.ok, false);
  const join = await b.timeout(2000).emitWithAck('room:join', { name: 'B', code: room.data.code });
  assert.equal(join.ok, false);
});
test('a new arrival gets no past content and remaining teammates survive a disconnect', async () => {
  const a = await client(),
    b = await client(),
    c = await client();
  const room = await a.timeout(2000).emitWithAck('room:create', { name: 'A', mode: 'team' });
  assert.ok(room.ok);
  await b.timeout(2000).emitWithAck('room:join', { name: 'B', code: room.data.code });
  await a.timeout(2000).emitWithAck('content:text', { kind: 'text', text: 'Before joining' });
  let pastReceived = false;
  c.on('content:text', () => {
    pastReceived = true;
  });
  const joinedMembership = event<{ name: string }[]>(b, 'room:members');
  const joined = await c
    .timeout(2000)
    .emitWithAck('room:join', { name: 'C', code: room.data.code });
  assert.ok(joined.ok);
  assert.equal((await joinedMembership).length, 3);
  assert.deepEqual(Object.keys(joined.data).sort(), ['code', 'expiresAt', 'members', 'mode']);
  assert.equal(pastReceived, false);
  const membership = event<{ name: string }[]>(b, 'room:members');
  a.disconnect();
  assert.equal((await membership).length, 2);
  await b.timeout(2000).emitWithAck('room:end');
});
test('untrusted payloads and HTML are handled as data', async () => {
  const a = await client(),
    b = await client();
  const created = await a
    .timeout(2000)
    .emitWithAck('room:create', { name: 'A'.repeat(100), mode: 'pair' });
  assert.equal(created.ok, false);
  const valid = await a
    .timeout(2000)
    .emitWithAck('room:create', { name: 'A'.repeat(32), mode: 'pair' });
  assert.ok(valid.ok);
  assert.equal(valid.data.members[0].name.length, 32);
  await b.timeout(2000).emitWithAck('room:join', { name: 'B', code: valid.data.code });
  const tooLong = await a
    .timeout(2000)
    .emitWithAck('content:text', { kind: 'text', text: 'a'.repeat(LIMITS.textLength + 1) });
  assert.equal(tooLong.ok, false);
  const html = await a
    .timeout(2000)
    .emitWithAck('content:text', { kind: 'text', text: '<script>alert(1)</script>' });
  assert.ok(html.ok);
  assert.equal(html.data.content.text, '<script>alert(1)</script>');
  await a.timeout(2000).emitWithAck('room:end');
});

test('formatted replies and code metadata reach peers without server history', async () => {
  const a = await client(),
    b = await client();
  const room = await a.timeout(2000).emitWithAck('room:create', { name: 'Alex', mode: 'pair' });
  assert.ok(room.ok);
  await b.timeout(2000).emitWithAck('room:join', { name: 'Sam', code: room.data.code });
  const original = await a
    .timeout(2000)
    .emitWithAck('content:text', { kind: 'text', text: '**Ready** to build?' });
  assert.ok(original.ok);
  const replyTo = { id: original.data.id, senderName: 'Alex', preview: '**Ready** to build?' };
  const incoming = event<{ content: { language: string; replyTo: typeof replyTo } }>(
    a,
    'content:text',
  );
  const response = await b.timeout(2000).emitWithAck('content:text', {
    kind: 'code',
    text: 'const gap = "connected";',
    language: 'typescript',
    replyTo,
  });
  assert.ok(response.ok);
  const received = await incoming;
  assert.equal(received.content.language, 'typescript');
  assert.deepEqual(received.content.replyTo, replyTo);
  const invalid = await b.timeout(2000).emitWithAck('content:text', {
    kind: 'text',
    text: 'Oops',
    replyTo: { ...replyTo, preview: 'x'.repeat(201) },
  });
  assert.equal(invalid.ok, false);
  await a.timeout(2000).emitWithAck('room:end');
});
