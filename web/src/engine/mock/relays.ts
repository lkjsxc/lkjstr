// The relays of the mock world: a fixed set the engine "knows" (in every honest state: quick, slow, connecting,
// refusing, not answering, idle) and the reader's own list, which `relays.save` really changes.
import type { RelayEntry, RelayRow } from '../protocol.ts';
import type { World } from './world.ts';

export { relayAddress as relayUrl } from '../../shared/address.ts';

const MIN = 60_000;
type RelaySpec = Omit<RelayRow, 'kind' | 'key' | 'retryAt'> & { readonly retryIn?: number };
const KNOWN: readonly RelaySpec[] = [
  {
    url: 'wss://relay.example.jp',
    state: 'connected',
    inUse: true,
    why: 'yours',
    read: true,
    write: true,
    subs: 4,
    events: 1840,
    latencyMs: 42,
    name: 'example.jp relay',
    software: 'strfry 1.2.0',
  },
  {
    url: 'wss://nos.example.net',
    state: 'connected',
    inUse: true,
    why: 'yours',
    read: true,
    write: true,
    subs: 3,
    events: 2210,
    latencyMs: 96,
    software: 'nostr-rs-relay 0.9',
  },
  {
    url: 'wss://relay.fischer.example',
    state: 'connected',
    inUse: true,
    why: 'outbox',
    read: false,
    write: false,
    subs: 1,
    events: 311,
    latencyMs: 180,
  },
  {
    url: 'wss://slow.example.org',
    state: 'connected',
    inUse: true,
    why: 'yours',
    read: true,
    write: false,
    subs: 2,
    events: 95,
    latencyMs: 2400,
    name: 'A slow relay',
  },
  {
    url: 'wss://search.example.com',
    state: 'connecting',
    inUse: true,
    why: 'search',
    read: false,
    write: false,
    subs: 1,
    events: 0,
  },
  {
    url: 'wss://down.example.net',
    state: 'failed',
    inUse: false,
    why: 'failing',
    read: true,
    write: true,
    subs: 0,
    events: 0,
    error: 'connection refused',
    retryIn: 4,
  },
  {
    url: 'wss://paid.example.com',
    state: 'failed',
    inUse: false,
    why: 'blocked',
    read: false,
    write: false,
    subs: 0,
    events: 0,
    error: 'auth-required: this relay is for members',
  },
  {
    url: 'wss://relay.lovell.example',
    state: 'idle',
    inUse: false,
    why: 'unused',
    read: false,
    write: false,
    subs: 0,
    events: 120,
  },
  {
    url: 'wss://old.example.org',
    state: 'idle',
    inUse: false,
    why: 'unused',
    read: false,
    write: false,
    subs: 0,
    events: 12,
  },
];

/** The reader's list as the mock world starts. */
export const initialRelays = (): RelayEntry[] =>
  KNOWN.filter((s) => s.read || s.write).map(({ url, read, write }) => ({ url, read, write }));

export const isKnown = (url: string): boolean => KNOWN.some((s) => s.url === url);
/** A relay the mock has not met answers after a moment, unless its name says it will not. */
export const answers = (url: string): boolean => !/down|fail/.test(url);

export function relays(w: World): RelayRow[] {
  const mine = new Map(w.state.relays.map((r) => [r.url, r]));
  const known: RelayRow[] = KNOWN.map(({ retryIn, ...s }) => {
    const entry = mine.get(s.url);
    const listed = s.read || s.write;
    const base = { ...s, kind: 'relay' as const, key: s.url, read: false, write: false };
    const retryAt = retryIn ? w.base + retryIn * MIN : undefined;
    // Taken off the reader's list: the engine still knows it, and no longer uses it.
    if (listed && !entry)
      return { ...base, state: 'idle', inUse: false, why: 'unused', subs: 0, error: undefined };
    if (!entry) return { ...base, retryAt };
    const failed = s.state === 'failed';
    return {
      ...base,
      read: entry.read,
      write: entry.write,
      retryAt,
      why: failed ? s.why : 'yours',
      state: s.state === 'idle' ? 'connected' : s.state,
      inUse: !failed,
      subs: failed ? 0 : Math.max(1, s.subs),
    };
  });
  const urls = new Set(KNOWN.map((s) => s.url));
  const added: RelayRow[] = w.state.relays
    .filter((r) => !urls.has(r.url))
    .map((r) => {
      const met = w.state.met.get(r.url);
      return {
        kind: 'relay',
        key: r.url,
        url: r.url,
        state: met ?? 'connecting',
        inUse: met !== 'failed',
        why: met === 'failed' ? 'failing' : 'yours',
        read: r.read,
        write: r.write,
        subs: met === 'connected' ? 1 : 0,
        events: 0,
        latencyMs: met === 'connected' ? 120 : undefined,
        error: met === 'failed' ? 'connection refused' : undefined,
        retryAt: met === 'failed' ? w.base + 5 * MIN : undefined,
      };
    });
  const rank = (r: RelayRow): number => (r.read || r.write ? 0 : r.inUse ? 1 : 2);
  return [...known, ...added].sort((a, b) => rank(a) - rank(b));
}
