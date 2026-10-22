export function isPrivateIpv4(host: string) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  return (
    parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

export function isLoopbackHost(host: string) {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    host === '0.0.0.0'
  );
}

/** Only substitute loopback URLs, preserving the actual frontend port and protocol. */
export function inviteOrigins(origin: string, lanHosts: readonly string[]): string[] {
  const url = new URL(origin);
  if (!isLoopbackHost(url.hostname)) return [url.origin];
  return [...new Set(lanHosts.filter(isPrivateIpv4))].map((host) => {
    const candidate = new URL(url);
    candidate.hostname = host;
    return candidate.origin;
  });
}

export const invitationUrl = (code: string, origin: string) =>
  `${new URL(origin).origin}/#/join/${code}`;
