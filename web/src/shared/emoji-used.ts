// The emoji this reader picks, on this device: the latest first, then the ones picked most, the older picks counting
// for less. And the skin tone they chose. Public choices, kept like settings.
import { kv } from './storage.ts';

/** A Unicode emoji, or `:code:` with the `url` of its picture and the `address` of its set when known. */
export type Picked = {
  readonly emoji: string;
  readonly url?: string;
  readonly address?: string;
  readonly source?: string;
  readonly set?: string;
};
type Used = Picked & { readonly n: number; readonly at: number };

const USED = 'emoji:used:2';
const TONE = 'emoji:tone';
/** Kept: enough that a favourite survives a run of one-off picks. Shown: two rows of the picker. */
const KEEP = 48;
export const SHOWN = 16;
const DAY = 86_400_000;

const valid = (x: unknown): x is Used =>
  typeof (x as Used)?.emoji === 'string' &&
  typeof (x as Used).n === 'number' &&
  typeof (x as Used).at === 'number' &&
  ['url', 'address', 'source', 'set'].every((key) => {
    const value = (x as unknown as Record<string, unknown>)[key];
    return value === undefined || typeof value === 'string';
  });

function stored(): Used[] {
  const value = kv.get(USED);
  return Array.isArray(value) ? value.filter(valid).slice(0, KEEP) : [];
}

/** Weight of a pick: a count that halves every two weeks of not being picked. */
const weight = (u: Used, now: number): number => u.n * 0.5 ** ((now - u.at) / (14 * DAY));

/** The latest pick, then the rest by weight. Pure over the list given; tested. */
export function ordered(list: readonly Used[], now: number): Used[] {
  if (!list.length) return [];
  const latest = list.reduce((a, b) => (b.at > a.at ? b : a));
  const rest = list.filter((u) => u !== latest).sort((a, b) => weight(b, now) - weight(a, now));
  return [latest, ...rest];
}

/** One more pick. Pure; tested. */
export function withPick(list: readonly Used[], p: Picked, now: number): Used[] {
  const was = list.find((u) => u.emoji === p.emoji && u.url === p.url && u.source === p.source);
  const next: Used = {
    emoji: p.emoji,
    ...(p.url ? { url: p.url } : {}),
    ...(p.address ? { address: p.address } : {}),
    ...(p.source ? { source: p.source } : {}),
    ...(p.set !== undefined ? { set: p.set } : {}),
    n: (was?.n ?? 0) + 1,
    at: now,
  };
  return ordered([next, ...list.filter((u) => u !== was)], now).slice(0, KEEP);
}

export function usedEmoji(now = Date.now()): Picked[] {
  return ordered(stored(), now)
    .slice(0, SHOWN)
    .map(({ emoji, url, address, source, set }) => ({
      emoji,
      ...(url ? { url } : {}),
      ...(address ? { address } : {}),
      ...(source ? { source } : {}),
      ...(set !== undefined ? { set } : {}),
    }));
}

export function recordPick(p: Picked, now = Date.now()): void {
  kv.set(USED, withPick(stored(), p, now));
}

/** 0 for none, 1 to 5 from light to dark. */
export function skinTone(): number {
  const v = kv.get(TONE);
  return typeof v === 'number' && v >= 0 && v <= 5 ? Math.floor(v) : 0;
}
export const setSkinTone = (tone: number): void => kv.set(TONE, tone);
