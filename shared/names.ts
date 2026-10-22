export function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 32 && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}
