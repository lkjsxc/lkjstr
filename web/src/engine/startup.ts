// Only engine plumbing changes between mock and release builds.
import { kv } from '../shared/storage.ts';
import { workerTransport as mockTransport, type Transport } from './client.ts';
import type { RelayEntry } from './protocol.ts';

export type BootstrapRelay = RelayEntry & { readonly search: boolean };
export const DEFAULT_RELAYS: readonly BootstrapRelay[] = [
  { url: 'wss://relay.damus.io/', read: true, write: true, search: false },
  { url: 'wss://nos.lol/', read: true, write: true, search: false },
  { url: 'wss://yabu.me/', read: true, write: true, search: false },
  { url: 'wss://search.nos.today/', read: false, write: false, search: true },
  { url: 'wss://relay.nostr.band/', read: false, write: false, search: true },
];

export function bootstrapRelays(account = kv.get('account') ?? ''): readonly BootstrapRelay[] {
  const saved = kv.get(`relays:${account}`);
  if (
    !Array.isArray(saved) ||
    saved.length > 8 ||
    !saved.every(
      (r) =>
        r &&
        typeof r.url === 'string' &&
        /^wss?:\/\//.test(r.url) &&
        typeof r.read === 'boolean' &&
        typeof r.write === 'boolean' &&
        typeof r.search === 'boolean',
    )
  )
    return DEFAULT_RELAYS;
  return saved;
}

/** NIP-65 edits carry read/write only; keep the frontend's independent search choice. */
export function savedRelays(
  account: string,
  entries: readonly RelayEntry[],
): readonly BootstrapRelay[] {
  const previous = bootstrapRelays(account);
  const next = entries.map((r) => ({
    ...r,
    search: previous.some((p) => p.url === r.url && p.search),
  }));
  for (const r of previous) {
    if (r.search && !next.some((p) => p.url === r.url) && next.length < 8)
      next.push({ ...r, read: false, write: false });
  }
  return next;
}

export async function createTransport(url: string): Promise<Transport> {
  if (!__REAL_ENGINE__) return mockTransport(url);
  const module: { workerTransport(options: { relays: readonly BootstrapRelay[] }): Transport } =
    await import(new URL(url, location.href).href);
  const transport = module.workerTransport({ relays: bootstrapRelays() });
  let account = kv.get('account') ?? '';
  // Bound by the transport's 64 in-flight actions. Persist only confirmed relay edits.
  const saves = new Map<string, { as: string; relays: readonly RelayEntry[] }>();
  return {
    post(msg, transfer) {
      if (msg.t === 'act' && msg.action.a === 'relays.save') saves.set(msg.req, msg.action);
      transport.post(msg, transfer);
    },
    listen(fn) {
      transport.listen((msg) => {
        if (msg.t === 'result') {
          const save = saves.get(msg.req);
          saves.delete(msg.req);
          if (save && msg.ok) kv.set(`relays:${save.as}`, savedRelays(save.as, save.relays));
        }
        if (msg.t === 'accounts' && account !== (msg.active ?? '')) {
          account = msg.active ?? '';
          transport.post({ t: 'relays', relays: bootstrapRelays(account) });
        }
        fn(msg);
      });
    },
    close() {
      saves.clear();
      transport.close();
    },
  };
}
