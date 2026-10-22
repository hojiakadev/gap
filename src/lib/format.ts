import { currentLocale, i18n } from '../i18n';
export function formatBytes(size: number) {
  const index = size < 1024 ? 0 : size < 1024 * 1024 ? 1 : 2;
  const value = new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: index ? 1 : 0,
    maximumFractionDigits: index ? 1 : 0,
  }).format(size / 1024 ** index);
  return `${value} ${i18n.t(['byteUnit', 'kilobyteUnit', 'megabyteUnit'][index])}`;
}
export function extractCode(input: string) {
  try {
    return new URL(input).hash.replace(/^#\/?join\//, '');
  } catch {
    return input;
  }
}
export async function copyText(text: string) {
  if (!navigator.clipboard)
    throw new Error(
      'Clipboard needs HTTPS or localhost. You can select and copy the visible invite link or tunnel code instead.',
    );
  await navigator.clipboard.writeText(text);
}
