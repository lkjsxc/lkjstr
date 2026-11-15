/** A local calendar day. Never use Date's permissive string parser. */
export function parseDateInput(
  raw: string,
  edge: 'start' | 'end',
  now = new Date(),
): string | undefined {
  const text = raw.normalize('NFKC').trim().toLowerCase();
  const day = (y: number, m: number, d: number): string | undefined => {
    if (y < 100 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
    const at = new Date(y, m - 1, d);
    return at.getFullYear() === y && at.getMonth() === m - 1 && at.getDate() === d
      ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      : undefined;
  };
  const relative = /^(\d+)(日前|週間前|か月前|ヶ月前|年前|[dwmy])$/.exec(text);
  if (relative || /^(今日|昨日|today|yesterday)$/.test(text)) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const n = relative ? Number(relative[1]) : /^(昨日|yesterday)$/.test(text) ? 1 : 0;
    if (!Number.isSafeInteger(n) || n > 100000) return undefined;
    const unit = relative?.[2] ?? 'd';
    if (/^(年前|y)$/.test(unit) || /^(か月前|ヶ月前|m)$/.test(unit)) {
      const months = n * (/^(年前|y)$/.test(unit) ? 12 : 1);
      const target = new Date(at.getFullYear(), at.getMonth() - months + 1, 0);
      return day(
        target.getFullYear(),
        target.getMonth() + 1,
        Math.min(at.getDate(), target.getDate()),
      );
    }
    at.setDate(at.getDate() - n * (/^(週間前|w)$/.test(unit) ? 7 : 1));
    return day(at.getFullYear(), at.getMonth() + 1, at.getDate());
  }
  const normalized = text
    .replace(/[年/.-]/g, '/')
    .replace(/月/g, '/')
    .replace(/日$/, '')
    .replace(/\/$/, '');
  const compact = /^\d{8}$/.test(normalized)
    ? `${normalized.slice(0, 4)}/${normalized.slice(4, 6)}/${normalized.slice(6)}`
    : normalized;
  if (!/^(\d{4}(\/\d{1,2}){0,2}|\d{1,2}\/\d{1,2})$/.test(compact)) return undefined;
  const parts = compact.split('/').map(Number);
  const full = (parts[0] ?? 0) >= 100;
  const y = full ? (parts[0] as number) : now.getFullYear();
  const m = full ? parts[1] : parts[0];
  const d = full ? parts[2] : parts[1];
  const month = m ?? (edge === 'end' ? 12 : 1);
  return day(y, month, d ?? (edge === 'end' ? new Date(y, month, 0).getDate() : 1));
}
