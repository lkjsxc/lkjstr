// Only media URLs selected by an explicitly public engine projection may be durable.
import type { Media, Row } from '../engine/protocol.ts';

type Size = { w: number; h: number };
type Saved = Size & { seen: number };
const KEY = 'lkjstr:public-media:1';
const MAX = 600;
const MAX_BYTES = 256 * 1024;
const seen = new Map<string, Size>();
const saved = new Map<string, Saved>();
const publicUrls = new Set<string>(); // At most twice the size cache; never private membership.
let loaded = false;
let touched = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const address = (value: string): string | undefined => {
  try {
    const url = new URL(value, location.href);
    return /^https?:$/.test(url.protocol) && url.href.length <= 4096 ? url.href : undefined;
  } catch {
    return;
  }
};
const valid = (size: Size): boolean =>
  Number.isInteger(size.w) &&
  Number.isInteger(size.h) &&
  size.w > 0 &&
  size.h > 0 &&
  size.w <= 131072 &&
  size.h <= 131072;
function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || (raw.length + KEY.length) * 2 > MAX_BYTES) return;
    const data = JSON.parse(raw) as { format: number; items: [string, Saved][] };
    if (data.format !== 1 || !Array.isArray(data.items) || data.items.length > MAX) return;
    for (const item of data.items) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [url, size] = item;
      if (
        typeof url === 'string' &&
        address(url) === url &&
        size &&
        valid(size) &&
        Number.isFinite(size.seen)
      )
        saved.set(url, size);
    }
  } catch {
    /* A damaged optional size cache is never an account-storage error. */
  }
}
function flush(): void {
  clearTimeout(timer);
  timer = undefined;
  touched = false;
  const entries = [...saved].sort((a, b) => a[1].seen - b[1].seen);
  let raw = JSON.stringify({ format: 1, items: entries });
  while (entries.length > MAX || (raw.length + KEY.length) * 2 > MAX_BYTES) {
    const old = entries.shift();
    if (!old) break;
    saved.delete(old[0]);
    raw = JSON.stringify({ format: 1, items: entries });
  }
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* Quota affects this optional cache only. */
  }
}
const dirty = (): void => {
  touched = true;
  timer ??= setTimeout(flush, 200);
};
window.addEventListener('pagehide', () => {
  if (touched) flush();
});

export function mediaSize(value: string): Size | undefined {
  load();
  const url = address(value) ?? value;
  const current = seen.get(url) ?? saved.get(url);
  if (current) {
    seen.delete(url);
    seen.set(url, current);
    if (seen.size > MAX) seen.delete(seen.keys().next().value ?? '');
    const previous = saved.get(url);
    if (previous) {
      saved.delete(url);
      saved.set(url, { ...current, seen: Date.now() });
      touched = true;
    }
  }
  return current;
}
export function learnMediaSize(value: string, w: number, h: number): void {
  if (!valid({ w, h })) return;
  load();
  const url = address(value) ?? value;
  seen.delete(url);
  seen.set(url, { w, h });
  if (seen.size > MAX) seen.delete(seen.keys().next().value ?? '');
  if (publicUrls.has(url)) {
    saved.delete(url);
    saved.set(url, { w, h, seen: Date.now() });
    if (saved.size > MAX) saved.delete(saved.keys().next().value ?? '');
    dirty();
  }
}
function permit(media: readonly Media[]): void {
  for (const item of media) {
    const url = address(item.thumb ?? item.url);
    if (!url) continue;
    publicUrls.delete(url);
    publicUrls.add(url);
    if (publicUrls.size > MAX * 2) publicUrls.delete(publicUrls.keys().next().value ?? '');
    const size = seen.get(url);
    if (size && !saved.has(url)) learnMediaSize(url, size.w, size.h);
  }
}
export function rememberPublicMedia(rows: readonly Row[]): void {
  load();
  for (const row of rows) {
    if (row.kind === 'notification' && row.note) rememberPublicMedia([row.note]);
    if (row.kind !== 'note') continue;
    permit(row.media);
    for (const quote of row.quotes) if (quote.state === 'ok') permit(quote.media);
  }
}
