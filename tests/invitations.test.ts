import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invitationUrl, inviteOrigins, isPrivateIpv4 } from '../src/lib/invitations';

test('localhost invites use a private interface and preserve the actual Vite port', () => {
  const origins = inviteOrigins('http://localhost:5174', ['192.168.1.10']);
  assert.deepEqual(origins, ['http://192.168.1.10:5174']);
  assert.equal(
    invitationUrl('aabbccddeeff', origins[0]),
    'http://192.168.1.10:5174/#/join/aabbccddeeff',
  );
});
test('loopback IPv4 and IPv6 cannot become cross-device invitations without a LAN address', () => {
  for (const origin of ['http://127.0.0.1:5173', 'http://[::1]:5173', 'http://localhost:5173']) {
    assert.deepEqual(inviteOrigins(origin, []), []);
    assert.deepEqual(inviteOrigins(origin, ['10.0.0.4']), ['http://10.0.0.4:5173']);
  }
});
test('LAN detection excludes public, invalid and loopback addresses and deduplicates choices', () => {
  assert.deepEqual(
    inviteOrigins('http://localhost:5173', [
      '192.168.0.4',
      '192.168.0.4',
      '8.8.8.8',
      '127.0.0.1',
      '10.0.0.3',
    ]),
    ['http://192.168.0.4:5173', 'http://10.0.0.3:5173'],
  );
  assert.equal(isPrivateIpv4('172.16.0.1'), true);
  assert.equal(isPrivateIpv4('172.31.255.255'), true);
  for (const host of ['172.32.0.1', '192.168.1.999', '192.168.1', '172.15.0.1'])
    assert.equal(isPrivateIpv4(host), false);
});
test('public and already-opened LAN origins stay unchanged', () => {
  for (const origin of ['https://gap.example.com', 'http://192.168.1.10:5173'])
    assert.deepEqual(inviteOrigins(origin, ['10.0.0.4']), [origin]);
});
