import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { io, type Socket } from 'socket.io-client';
import { createRelay } from '../server/relay';

test('cross-origin polling, CORS preflight and WebSocket handshakes work only for the configured site', async () => {
  const http = createServer();
  const origin = 'https://gap-test.netlify.app';
  const relay = createRelay(http, { allowedOrigins: [origin], production: true });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const clients: Socket[] = [];
  const client = (clientOrigin: string, transport: 'polling' | 'websocket') =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(url, {
        transports: [transport],
        extraHeaders: { Origin: clientOrigin },
        forceNew: true,
        reconnection: false,
        timeout: 2000,
      });
      clients.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  try {
    const preflight = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    const a = await client(origin, 'polling');
    const b = await client(origin, 'websocket');
    const missing = await a.timeout(2000).emitWithAck('room:create', { name: '   ', mode: 'pair' });
    assert.equal(missing.ok, false);
    const room = await a.timeout(2000).emitWithAck('room:create', { name: 'Otabek', mode: 'pair' });
    assert.equal(room.ok, true);
    const noName = await b
      .timeout(2000)
      .emitWithAck('room:join', { name: '', code: room.data.code });
    assert.equal(noName.ok, false);
    assert.ok(
      (await b.timeout(2000).emitWithAck('room:join', { name: 'Алексей', code: room.data.code }))
        .ok,
    );
    const incoming = new Promise<{ content: { text: string }; sender: { name: string } }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Delivery timed out')), 2000);
        b.once('content:text', (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      },
    );
    await a
      .timeout(2000)
      .emitWithAck('content:text', { kind: 'text', text: 'Cross-origin delivery' });
    const message = await incoming;
    assert.equal(message.content.text, 'Cross-origin delivery');
    assert.equal(message.sender.name, 'Otabek');
    await assert.rejects(client('https://untrusted.netlify.app', 'websocket'));
    const denied = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: 'https://untrusted.netlify.app' },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    await a.timeout(2000).emitWithAck('room:end');
  } finally {
    for (const client of clients) client.disconnect();
    await new Promise<void>((resolve) => relay.close(() => resolve()));
  }
});
