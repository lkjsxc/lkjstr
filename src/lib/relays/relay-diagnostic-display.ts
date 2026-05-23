export function relayDiagnosticDisplayMessage(message: string): string {
  if (!message.startsWith('relay message too large')) return message;
  const match = message.match(/: (\d+) bytes exceeds (\d+) byte limit/);
  if (!match) return 'oversized relay message skipped';
  return `oversized relay message skipped (${match[1]} bytes, limit ${match[2]} bytes)`;
}
