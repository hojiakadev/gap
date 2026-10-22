import { pathToFileURL } from 'node:url';
export function validateRelayUrl(value) {
  if (!value?.trim())
    throw new Error(
      'Set VITE_RELAY_URL in Netlify to the public HTTPS Render relay origin before deploying.',
    );
  const url = new URL(value.trim());
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    /^(localhost|127\.|\[::1\])/.test(url.hostname) ||
    url.hostname.endsWith('.example.com')
  ) {
    throw new Error(
      'VITE_RELAY_URL must be a real HTTPS relay origin without paths, credentials, or query strings.',
    );
  }
  return url.origin;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateRelayUrl(process.env.VITE_RELAY_URL);
    console.log('Netlify relay configuration is valid.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
