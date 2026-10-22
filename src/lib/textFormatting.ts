export type InlineToken = { kind: 'text' | 'bold' | 'italic' | 'code' | 'link'; text: string };
/** A deliberately small text-only format. HTML and arbitrary Markdown URLs are never interpreted. */
export function inlineTokens(text: string): InlineToken[] {
  const expression = /https?:\/\/[^\s<>]+|`([^`\n]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_/g;
  const tokens: InlineToken[] = [];
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    if (match.index > cursor) tokens.push({ kind: 'text', text: text.slice(cursor, match.index) });
    tokens.push(
      match[0].startsWith('http')
        ? { kind: 'link', text: match[0] }
        : match[1] !== undefined
          ? { kind: 'code', text: match[1] }
          : match[2] !== undefined
            ? { kind: 'bold', text: match[2] }
            : { kind: 'italic', text: match[3] ?? match[4] },
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) tokens.push({ kind: 'text', text: text.slice(cursor) });
  return tokens;
}
export function formatSelection(
  text: string,
  start: number,
  end: number,
  marker: '**' | '_',
  placeholder?: string,
) {
  const selected = text.slice(start, end);
  if (
    start >= marker.length &&
    text.slice(start - marker.length, start) === marker &&
    text.slice(end, end + marker.length) === marker
  ) {
    return {
      text: text.slice(0, start - marker.length) + selected + text.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }
  const inner = selected || placeholder || (marker === '**' ? 'bold text' : 'italic text');
  return {
    text: text.slice(0, start) + marker + inner + marker + text.slice(end),
    start: start + marker.length,
    end: start + marker.length + inner.length,
  };
}

export function plainText(text: string, depth = 0): string {
  return inlineTokens(text)
    .map((token) =>
      depth < 4 && (token.kind === 'bold' || token.kind === 'italic')
        ? plainText(token.text, depth + 1)
        : token.text,
    )
    .join('');
}
