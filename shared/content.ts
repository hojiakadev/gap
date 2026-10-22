import { CODE_LANGUAGES, type TextContent } from './protocol';
/** Strip unexpected properties at the relay boundary; no content is retained. */
export function normalizeContent(content: TextContent): TextContent | null {
  if (
    content.language !== undefined &&
    (content.kind !== 'code' || !CODE_LANGUAGES.includes(content.language))
  )
    return null;
  const reply = content.replyTo;
  if (
    reply !== undefined &&
    (!reply ||
      typeof reply.id !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(reply.id) ||
      typeof reply.senderName !== 'string' ||
      reply.senderName.length > 32 ||
      typeof reply.preview !== 'string' ||
      reply.preview.length > 200)
  )
    return null;
  return {
    kind: content.kind,
    text: content.text,
    ...(content.kind === 'code' ? { language: content.language ?? 'plaintext' } : {}),
    ...(reply
      ? { replyTo: { id: reply.id, senderName: reply.senderName, preview: reply.preview } }
      : {}),
  };
}
