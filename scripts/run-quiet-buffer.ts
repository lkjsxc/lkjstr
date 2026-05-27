export const OUTPUT_MAX_BYTES = 128 * 1024;

export function appendBounded(
  buffer: string,
  next: string,
  maxBytes: number,
): string {
  const combined = buffer + next;
  if (Buffer.byteLength(combined, 'utf8') <= maxBytes) return combined;
  let trimmed = combined;
  while (Buffer.byteLength(trimmed, 'utf8') > maxBytes && trimmed.length > 0) {
    trimmed = trimmed.slice(Math.max(1, trimmed.length - maxBytes));
  }
  return trimmed;
}
