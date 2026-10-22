import type { IncomingMessage } from 'node:http';
export interface OriginPolicy {
  allowedOrigins: string[];
  production: boolean;
}
export function parseAllowedOrigins(input: string | undefined): string[] {
  return [
    ...new Set(
      (input ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          const url = new URL(value);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.pathname !== '/' ||
            url.search ||
            url.hash
          )
            throw new Error(
              'ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths or credentials.',
            );
          return url.origin;
        }),
    ),
  ];
}
export function originAllowed(
  origin: string | undefined,
  request: Pick<IncomingMessage, 'headers' | 'socket'>,
  policy: OriginPolicy,
) {
  // Native clients and platform health checks do not send browser Origin headers.
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
    if (policy.allowedOrigins.includes(parsed.origin)) return true;
    if (policy.production) return false;
    // The Vite dev proxy preserves Host. Same-origin checks include the protocol.
    const scheme = 'encrypted' in request.socket && request.socket.encrypted ? 'https' : 'http';
    return parsed.origin === `${scheme}://${request.headers.host}`;
  } catch {
    return false;
  }
}
