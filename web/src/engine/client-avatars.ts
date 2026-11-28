// One page's face leases and its session picture cache. Durable bytes stay in the Worker.

import {
  type AvatarLease,
  type AvatarValue,
  type Entry,
  MAX_BYTES,
  MAX_PENDING,
  MAX_URLS,
  NEGATIVE_MS,
  type Receive,
  rankOf,
  readyBlob,
} from './client-avatar-values.ts';
import type { Transport } from './client-transport.ts';
import type { FromEngine } from './protocol.ts';

export type { AvatarLease, AvatarValue };

export type AvatarClient = ReturnType<typeof createAvatarClient>;
export function createAvatarClient(transport: Transport) {
  const entries = new Map<string, Entry>(); // <=1024 exact URLs.
  const idle = new Map<string, Entry>(); // Unowned settled entries, least recently released first.
  const pending = new Map<string, Entry>(); // <=256, one request per unsettled owned URL.
  const listeners = new Set<() => void>(); // one per mounted avatar root.
  let serial = 0,
    epoch = 0,
    bytes = 0,
    unsettled = 0,
    visible = true,
    disposed = false,
    queued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = (entry: Entry, value: AvatarValue): void => {
    if ((entry.value.kind === 'pending') !== (value.kind === 'pending'))
      unsettled += value.kind === 'pending' ? 1 : -1;
    entry.value = value;
  };
  const publish = (entry: Entry, value: AvatarValue): void => {
    settle(entry, value);
    for (const [id, owner] of [...entry.owners]) {
      if (entry.value !== value) break;
      if (entry.owners.get(id) === owner) owner.receive(value);
    }
  };
  const capacity = (): void => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!disposed) for (const receive of listeners) receive();
    });
  };
  const cancel = (entry: Entry): void => {
    const req = entry.req;
    entry.req = undefined;
    entry.retry = undefined;
    if (req && pending.delete(req)) transport.post({ t: 'avatar.close', req });
  };
  const revoke = (entry: Entry): void => {
    const previous = entry.objectUrl;
    entry.objectUrl = undefined;
    entry.holder?.removeAttribute('src');
    entry.holder = undefined;
    bytes -= entry.bytes;
    entry.bytes = 0;
    if (previous) URL.revokeObjectURL(previous);
  };
  const discard = (entry: Entry): void => {
    if (entries.get(entry.url) !== entry) return;
    entries.delete(entry.url);
    idle.delete(entry.url);
    cancel(entry);
    revoke(entry);
    if (entry.value.kind === 'pending') unsettled--;
  };
  /** Drop unowned pictures, oldest first, until the session cache has room for one more. */
  const trim = (): void => {
    while (idle.size && (entries.size > MAX_URLS || bytes > MAX_BYTES))
      discard(idle.values().next().value!);
  };
  const invalidate = (): Entry[] => {
    epoch++;
    clearTimeout(timer);
    timer = undefined;
    const current = [...entries.values()];
    // Invalidate every old URL before any callback can resume or receive a synchronous cache hit.
    for (const entry of current) {
      cancel(entry);
      revoke(entry);
      settle(entry, { kind: 'pending' });
      if (!entry.owners.size) discard(entry);
    }
    return current;
  };
  const request = (entry: Entry): void => {
    if (
      disposed ||
      !visible ||
      !entry.owners.size ||
      entry.value.kind !== 'pending' ||
      entries.get(entry.url) !== entry
    )
      return;
    const rank = rankOf(entry),
      previous = entry.req;
    if (previous && (entry.sent ?? 0) <= rank) return;
    entry.retry = undefined;
    const req = `av${++serial}`;
    entry.req = req;
    entry.sent = rank;
    pending.set(req, entry); // Install before post: the mock may answer synchronously.
    transport.post({
      t: 'avatar.want',
      req,
      url: entry.url,
      ...(rank ? { rank } : {}),
      ...(entry.observePublic ? { observePublic: true } : {}),
    });
    // A face that came on screen joins its own job at the better rank before the old request leaves it.
    if (previous && pending.delete(previous)) transport.post({ t: 'avatar.close', req: previous });
  };
  const schedule = (): void => {
    clearTimeout(timer);
    timer = undefined;
    if (disposed || !visible) return;
    let at = Infinity;
    for (const entry of entries.values())
      if (entry.retry !== undefined) at = Math.min(at, entry.retry);
    if (!Number.isFinite(at)) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        const now = performance.now();
        for (const entry of entries.values())
          if (entry.retry !== undefined && entry.retry <= now) request(entry);
        schedule();
      },
      Math.max(1, at - performance.now()),
    );
  };
  const pagehide = (): void => client.visible(false);
  const pageshow = (): void => client.visible(document.visibilityState !== 'hidden');
  const client = {
    acquire(
      url: string,
      receive: Receive,
      observePublic = false,
      rank = 0,
    ): AvatarLease | undefined {
      if (disposed) return;
      if (!url || new TextEncoder().encode(url).length > 2048) {
        receive({ kind: 'rejected' });
        return Object.assign(() => undefined, { rank: () => undefined });
      }
      let entry = entries.get(url);
      if (entry && !entry.owners.size && entry.until !== undefined && entry.until <= Date.now()) {
        discard(entry);
        entry = undefined;
      }
      if (!entry) {
        if (unsettled >= MAX_PENDING) return;
        if (entries.size >= MAX_URLS && !idle.size) return;
        entry = {
          url,
          epoch,
          observePublic,
          owners: new Map(),
          value: { kind: 'pending' },
          bytes: 0,
        };
        entries.set(url, entry);
        unsettled++;
        trim();
      }
      idle.delete(url);
      const owned = entry,
        id = ++serial,
        owner = { receive, rank };
      owned.owners.set(id, owner);
      receive(owned.value);
      if (owned.value.kind === 'pending' && owned.retry === undefined) request(owned);
      const release = (): void => {
        if (!owned.owners.delete(id)) return;
        if (!owned.owners.size) {
          if (!disposed && owned.epoch === epoch && owned.value.kind !== 'pending') {
            // The session keeps what it has shown: a returning row draws it without asking again.
            if (owned.value.kind !== 'ready') owned.until = Date.now() + NEGATIVE_MS;
            idle.set(url, owned);
            trim();
          } else discard(owned);
          schedule();
        }
        capacity();
      };
      return Object.assign(release, {
        rank(next: number): void {
          if (owner.rank === next || !owned.owners.has(id)) return;
          owner.rank = next;
          if (owned.value.kind === 'pending' && owned.retry === undefined) request(owned);
        },
      });
    },
    receive(message: FromEngine): boolean {
      if (message.t !== 'avatar') return false;
      if (disposed) return true;
      const entry = pending.get(message.req);
      if (!entry || entry.req !== message.req) return true;
      pending.delete(message.req);
      entry.req = undefined;
      if (message.result.status === 'deferred') {
        const ms = message.result.retryMs;
        if (!Number.isFinite(ms) || ms < 1) publish(entry, { kind: 'rejected' });
        else entry.retry = performance.now() + Math.min(ms, 60000);
        schedule();
      } else if (message.result.status === 'ready') {
        const blob = readyBlob(message);
        if (!blob) publish(entry, { kind: 'rejected' });
        else {
          try {
            const objectUrl = URL.createObjectURL(blob);
            entry.objectUrl = objectUrl;
            entry.bytes = blob.size;
            bytes += blob.size;
            const holder = new Image();
            holder.decoding = 'sync';
            holder.src = objectUrl;
            entry.holder = holder;
            publish(entry, { kind: 'ready', url: objectUrl });
            trim();
          } catch {
            publish(entry, { kind: 'fallback', uniform: false });
          }
        }
      } else if (message.result.status === 'fallback')
        publish(entry, { kind: 'fallback', uniform: message.result.uniform });
      else publish(entry, { kind: 'rejected' });
      if (entry.value.kind !== 'pending') capacity();
      return true;
    },
    onCapacity(receive: () => void): () => void {
      if (disposed) return () => undefined;
      listeners.add(receive);
      return () => {
        listeners.delete(receive);
      };
    },
    /** Account removal: nothing drawn for the old session may answer a new one. */
    reset(): void {
      if (disposed) return;
      const current = invalidate();
      const token = epoch;
      for (const entry of current) {
        if (disposed || token !== epoch) return;
        if (entries.get(entry.url) === entry) publish(entry, entry.value);
      }
      for (const entry of current) {
        if (disposed || !visible || token !== epoch) return;
        request(entry);
      }
    },
    /** A hidden page stops asking. It keeps every picture it holds, so the return draws at once. */
    visible(on: boolean): void {
      if (disposed || visible === on) return;
      visible = on;
      if (!on) {
        clearTimeout(timer);
        timer = undefined;
        for (const entry of [...pending.values()]) cancel(entry);
        return;
      }
      for (const entry of [...entries.values()]) {
        if (disposed || !visible) break;
        request(entry);
      }
      schedule();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      clearTimeout(timer);
      for (const entry of entries.values()) {
        cancel(entry);
        revoke(entry);
        publish(entry, { kind: 'pending' });
        entry.owners.clear();
      }
      entries.clear();
      idle.clear();
      pending.clear();
      listeners.clear();
    },
  };
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', pageshow);
  return client;
}
