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
    url: 'wss://relay.fischer.example/reading-home-a',
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

const tally = (text: string): number =>
  [...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
/** The notes a relay served in the mock world: a fixed third of them, none from one that never answers. */
export const servedBy = (url: string, id: string): boolean =>
  answers(url) && (tally(url) + tally(id)) % 3 === 0;

/** The head of a Relay tab (`relay` source): the row the Relays tab has, with what the relay says of itself. */
export function relayHead(w: World, url: string, admin?: RelayRow['admin']): RelayRow {
  const known = relays(w).find((r) => r.url === url);
  const row: RelayRow = known ?? {
    kind: 'relay',
    key: url,
    url,
    state: answers(url) ? 'connected' : 'failed',
    inUse: answers(url),
    why: 'unused',
    read: false,
    write: false,
    subs: 0,
    events: 0,
    latencyMs: answers(url) ? 140 : undefined,
    error: answers(url) ? undefined : 'connection refused',
  };
  if (!answers(url)) return { ...row, key: `relay:${url}`, info: 'missing' };
  return {
    ...row,
    key: `relay:${url}`,
    info: 'ready',
    name: row.name ?? 'Example community relay',
    description:
      'A public relay for notes in Japanese and English. Be kind; spam is removed.\nRetention: one year.',
    software: row.software?.split(' ')[0] ?? 'git+https://github.com/example/relay.git',
    version: row.software?.split(' ')[1] ?? '1.4.2',
    contact: 'admin@example.jp',
    admin,
    nips: [1, 2, 4, 9, 11, 22, 28, 40, 42, 50, 70, 77],
    limits: url.includes('paid') ? ['auth', 'payment'] : ['restricted'],
    pow: url.includes('slow') ? 16 : undefined,
  };
}
