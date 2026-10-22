import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSelection, inlineTokens, plainText } from '../src/lib/textFormatting';
import { normalizeContent } from '../shared/content';
import type { TextContent } from '../shared/protocol';

test('keyboard formatting wraps a selection, toggles it off, and selects placeholder text', () => {
  const bold = formatSelection('Hello team', 6, 10, '**');
  assert.deepEqual(bold, { text: 'Hello **team**', start: 8, end: 12 });
  assert.deepEqual(formatSelection(bold.text, bold.start, bold.end, '**'), {
    text: 'Hello team',
    start: 6,
    end: 10,
  });
  assert.deepEqual(formatSelection('Hi ', 3, 3, '_'), {
    text: 'Hi _italic text_',
    start: 4,
    end: 15,
  });
});
test('text parsing supports bold, italic, inline code, and safe HTTP links', () => {
  const tokens = inlineTokens('**Bold** and _italic_ with `x = 1` https://example.com');
  assert.deepEqual(
    tokens.filter((token) => token.kind !== 'text').map((token) => token.kind),
    ['bold', 'italic', 'code', 'link'],
  );
  const unsafe = inlineTokens('<img src=x onerror=alert(1)> [click](javascript:alert(1))');
  assert.equal(
    unsafe.some((token) => token.kind === 'link'),
    false,
  );
  assert.equal(
    unsafe.map((token) => token.text).join(''),
    '<img src=x onerror=alert(1)> [click](javascript:alert(1))',
  );
});
test('relay normalization rejects invalid language and unbounded reply payloads', () => {
  assert.equal(
    normalizeContent({ kind: 'code', text: 'x', language: 'unknown' } as unknown as TextContent),
    null,
  );
  assert.equal(
    normalizeContent({
      kind: 'text',
      text: 'x',
      replyTo: { id: 'not-an-id', senderName: 'A', preview: 'Hello' },
    }),
    null,
  );
  assert.equal(
    normalizeContent({
      kind: 'text',
      text: 'x',
      replyTo: {
        id: '12345678-1234-1234-1234-123456789012',
        senderName: 'A',
        preview: 'x'.repeat(201),
      },
    }),
    null,
  );
  assert.deepEqual(normalizeContent({ kind: 'code', text: 'const x = 1' }), {
    kind: 'code',
    text: 'const x = 1',
    language: 'plaintext',
  });
});

test('reply excerpts omit formatting delimiters while retaining their text', () => {
  assert.equal(plainText('**Hello _team_** and `const x`'), 'Hello team and const x');
});
