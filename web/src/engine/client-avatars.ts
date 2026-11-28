// One page's bounded face leases and recently ready URLs. Durable bytes stay in the Worker.
import type { Transport } from './client-transport.ts';
import type { AvatarOutput, FromEngine } from './protocol.ts';

export type AvatarValue =
  | { readonly kind: 'pending' | 'rejected' }
  | { readonly kind: 'ready'; readonly url: string }
  | { readonly kind: 'fallback'; readonly uniform: boolean };
type Receive = (value: AvatarValue) => void;
type Entry = {
  url: string;
  epoch: number;
  observePublic: boolean;
  owners: Map<number, Receive>;
  value: AvatarValue;
  req?: string;
  retry?: number;
  objectUrl?: string;
};
const readyBlob = (message: AvatarOutput): Blob | undefined => {
  const { blob, image } = message;
  if (
    !(blob instanceof Blob) ||
    !image ||
    blob.size < 1 ||
    blob.size > 131072 ||
    image.bytes !== blob.size ||
    image.mime !== blob.type ||
    !['image/webp', 'image/jpeg', 'image/png'].includes(blob.type) ||
    !Number.isInteger(image.edge) ||
    image.edge < 1 ||
    image.edge > 160 ||
    !Number.isInteger(image.sourceWidth) ||
    !Number.isInteger(image.sourceHeight) ||
    image.sourceWidth < image.edge ||
    image.sourceHeight < image.edge
  )
    return;
  return blob;
};
export type AvatarClient = ReturnType<typeof createAvatarClient>;
export function createAvatarClient(transport: Transport) {
  const entries = new Map<string, Entry>(); // <=256 total exact URLs, including idle ready values.
  const idle = new Map<string, Entry>(); // <=64 least-recently released stills; <=8 MiB inside the total cap.
  const pending = new Map<string, Entry>(); // <=256, one per owned URL.
  const listeners = new Set<() => void>(); // one per mounted avatar root.
  let serial = 0,
    epoch = 0,
    owners = 0,
    visible = true,
    disposed = false,
    queued = false,
    visibilityGeneration = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = (entry: Entry, value: AvatarValue): void => {
    entry.value = value;
    for (const [id, receive] of [...entry.owners]) {
      if (entry.value !== value) break;
      if (entry.owners.get(id) === receive) receive(value);
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
    if (previous) URL.revokeObjectURL(previous);
  };
  const discard = (entry: Entry): void => {
    entries.delete(entry.url);
    idle.delete(entry.url);
    cancel(entry);
    revoke(entry);
  };
  const trimIdle = (limit: number): void => {
    while (idle.size > limit) discard(idle.values().next().value!);
  };
  const clearIdle = (): void => {
    trimIdle(0);
    capacity();
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
      entry.value = { kind: 'pending' };
      if (!entry.owners.size) discard(entry);
    }
    return current;
  };
  const request = (entry: Entry): void => {
    if (
      disposed ||
      !visible ||
      !entry.owners.size ||
      entry.req ||
      entry.value.kind !== 'pending' ||
      entries.get(entry.url) !== entry
    )
      return;
    entry.retry = undefined;
    const req = `av${++serial}`;
    entry.req = req;
    pending.set(req, entry); // Install before post: the mock may answer synchronously.
    transport.post({
      t: 'avatar.want',
      req,
      url: entry.url,
      ...(entry.observePublic ? { observePublic: true } : {}),
    });
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
    acquire(url: string, receive: Receive, observePublic = false): (() => void) | undefined {
      if (disposed) return;
      if (!url || new TextEncoder().encode(url).length > 2048) {
        receive({ kind: 'rejected' });
        return () => undefined;
      }
      let entry = entries.get(url);
      if (owners >= 512) return;
      if (!entry && entries.size >= 256) trimIdle(Math.max(0, idle.size - 1));
      if (!entry && entries.size >= 256) return;
      idle.delete(url);
      if (!entry) {
        entry = { url, epoch, observePublic, owners: new Map(), value: { kind: 'pending' } };
        entries.set(url, entry);
      }
      const owned = entry,
        id = ++serial;
      owned.owners.set(id, receive);
      owners++;
      receive(owned.value);
      if (owned.value.kind === 'pending' && owned.retry === undefined) request(owned);
      return () => {
        if (!owned.owners.delete(id)) return;
        owners--;
        if (!owned.owners.size) {
          if (!disposed && visible && owned.epoch === epoch && owned.value.kind === 'ready') {
            idle.set(url, owned);
            trimIdle(64);
          } else discard(owned);
          schedule();
        }
        capacity();
      };
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
            entry.objectUrl = URL.createObjectURL(blob);
            publish(entry, { kind: 'ready', url: entry.objectUrl });
          } catch {
            publish(entry, { kind: 'fallback', uniform: false });
          }
        }
      } else if (message.result.status === 'fallback')
        publish(entry, { kind: 'fallback', uniform: message.result.uniform });
      else publish(entry, { kind: 'rejected' });
      return true;
    },
    onCapacity(receive: () => void): () => void {
      if (disposed) return () => undefined;
      listeners.add(receive);
      return () => {
        listeners.delete(receive);
      };
    },
    clearIdle,
    reset(): void {
      if (disposed) return;
      const token = ++visibilityGeneration,
        current = invalidate();
      for (const entry of current) {
        if (disposed || token !== visibilityGeneration) return;
        if (entries.get(entry.url) === entry) publish(entry, entry.value);
      }
      for (const entry of current) {
        if (disposed || !visible || token !== visibilityGeneration) return;
        request(entry);
      }
    },
    visible(on: boolean): void {
      if (disposed || visible === on) return;
      visible = on;
      const token = ++visibilityGeneration;
      const current = on ? [...entries.values()] : invalidate();
      if (!on) {
        for (const entry of current) {
          if (disposed || visible || token !== visibilityGeneration) break;
          if (entries.get(entry.url) === entry) publish(entry, entry.value);
        }
      } else
        for (const entry of current) {
          if (disposed || !visible || token !== visibilityGeneration) break;
          request(entry);
        }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      visibilityGeneration++;
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
      owners = 0;
    },
  };
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', pageshow);
  return client;
}
