// Finished public view models only. Raw events, actions, keys and private bodies never enter this store.
import type { Anchor, Query, Row } from './protocol.ts';

const PREFIX = 'lkjstr:public-view:1:';
const MAX_ENTRIES = 32;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ENTRY_BYTES = 192 * 1024;
export const SNAPSHOT_ROWS = 64;

export type SnapshotWindow = { readonly maxAgeMs: number; readonly through?: number };
export type PublicSnapshot = {
  readonly rows: readonly Row[];
  readonly anchor: string;
  readonly atTop: boolean;
  readonly atBottom: boolean;
  readonly window?: SnapshotWindow;
};
type Envelope = { version: 2; seen: number; body: string; check: number };
const rowKinds = new Set(['note', 'notification', 'profile', 'person', 'channel', 'mute', 'emoji']);
const fingerprint = (text: string): number => {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
};
const backend = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};
const canonical = (query: Query): string =>
  JSON.stringify(Object.fromEntries(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))));
const mergedHistory = new Set([
  'home',
  'their-home',
  'global',
  'hashtag',
  'search',
  'channel',
  'notifications',
]);
export const snapshotIdentity = (
  query: Query,
  language: string,
  previews: boolean,
  visitorFilter = true,
): string =>
  JSON.stringify([
    language,
    previews,
    visitorFilter,
    canonical(query),
    // Earlier Their Home entries can hold Moment order or predate its public mute policy.
    ...(query.source === 'their-home' ? ['ordinary', 'public-mutes'] : []),
    // Older Profile Posts snapshots can contain unrelated repost attribution and authored order.
    ...(query.source === 'profile' && (query.show === undefined || query.show === 'posts')
      ? ['profile-posts']
      : []),
    ...(mergedHistory.has(query.source) ? ['covered-history'] : []),
  ]);

export const hasAbsoluteReadingTime = (row: Row): boolean =>
  row.kind === 'note' && row.readingAt !== undefined;

export function snapshotSafe(row: Row): boolean {
  if (row.kind === 'emoji') return typeof row.source === 'string' && row.source.length > 0;
  if (row.kind === 'notification')
    return row.expiresAt === undefined && (!row.note || snapshotSafe(row.note));
  return (
    row.kind !== 'note' ||
    (!hasAbsoluteReadingTime(row) &&
      !row.revealed &&
      !row.hidden?.detail &&
      row.expiresAt === undefined)
  );
}
const keyFor = (identity: string, top: boolean): string =>
  PREFIX + (top ? 'top:' : 'read:') + identity;

function decode(raw: string | null): PublicSnapshot | undefined {
  if (!raw || raw.length * 2 > MAX_ENTRY_BYTES) return;
  try {
    const value = JSON.parse(raw) as Envelope;
    if (
      value.version !== 2 ||
      typeof value.body !== 'string' ||
      value.check !== fingerprint(value.body)
    )
      return;
    const body = JSON.parse(value.body) as PublicSnapshot;
    if (
      !Array.isArray(body.rows) ||
      body.rows.length === 0 ||
      body.rows.length > SNAPSHOT_ROWS ||
      typeof body.anchor !== 'string' ||
      typeof body.atTop !== 'boolean' ||
      typeof body.atBottom !== 'boolean' ||
      (body.window !== undefined &&
        (!body.window ||
          !Number.isSafeInteger(body.window.maxAgeMs) ||
          body.window.maxAgeMs <= 0 ||
          (body.window.through !== undefined && !Number.isSafeInteger(body.window.through)))) ||
      !body.rows.every(
        (row) =>
          row &&
          typeof row.key === 'string' &&
          row.key.length > 0 &&
          row.key.length <= 512 &&
          rowKinds.has(row.kind),
      ) ||
      !body.rows.every(snapshotSafe) ||
      !body.rows.some((row) => row.key === body.anchor)
    )
      return;
    if (!body.window) return body;
    const eligible = snapshotRows(body.rows, body.window);
    const keys = new Set(eligible.map((row) => row.key));
    const removed = new Set(body.rows.filter((row) => !keys.has(row.key)).map((row) => row.key));
    return removed.size ? withoutPublicRows({ ...body, atBottom: false }, removed) : body;
  } catch {
    return;
  }
}

export function snapshotRows(rows: readonly Row[], window?: SnapshotWindow): readonly Row[] {
  if (!window) return rows;
  const floor = Math.min(Date.now(), window.through ?? Infinity) - window.maxAgeMs;
  const eligible = rows.filter(
    (row) => (row.kind !== 'note' && row.kind !== 'notification') || row.at >= floor,
  );
  return eligible.some((row) => row.kind === 'note' || row.kind === 'notification') ? eligible : [];
}

export function readPublicSnapshot(identity: string, anchor: Anchor): PublicSnapshot | undefined {
  if (identity.length > 8192 || (typeof anchor === 'object' && !('key' in anchor))) return;
  try {
    const store = backend();
    const top = anchor === 'top';
    const key = keyFor(identity, top);
    const raw = store?.getItem(key) ?? null;
    const snapshot = decode(raw);
    const requested = typeof anchor === 'object' && 'key' in anchor ? anchor.key : undefined;
    if (!snapshot || (!top && !snapshot.rows.some((row) => row.key === requested))) return;
    if (raw) {
      const envelope = JSON.parse(raw) as Envelope;
      try {
        store?.setItem(key, JSON.stringify({ ...envelope, seen: Date.now() }));
      } catch {
        /* cache touch only */
      }
    }
    return snapshot;
  } catch {
    return;
  }
}

export function forgetPublicSnapshot(identity: string): void {
  try {
    const store = backend();
    store?.removeItem(keyFor(identity, true));
    store?.removeItem(keyFor(identity, false));
  } catch {
    // A denied cache never changes account or layout storage.
  }
}

export function withoutPublicRows(
  snapshot: PublicSnapshot,
  removed: ReadonlySet<string>,
): PublicSnapshot | undefined {
  const rows = snapshot.rows.filter((row) => !removed.has(row.key));
  if (!rows.length) return;
  const anchor =
    rows.find((row) => row.key === snapshot.anchor) ??
    rows.find((row) => row.kind === 'note' || row.kind === 'notification') ??
    rows[0];
  return anchor ? { ...snapshot, rows, anchor: anchor.key } : undefined;
}

/** Positive engine evidence rewrites both saved windows without changing their last-read age. */
export function rewritePublicSnapshots(
  identity: string,
  rewrite: (snapshot: PublicSnapshot) => PublicSnapshot | undefined,
): void {
  if (identity.length > 8192) return;
  try {
    const store = backend();
    if (!store) return;
    for (const top of [false, true]) {
      const key = keyFor(identity, top);
      const raw = store.getItem(key);
      const snapshot = decode(raw);
      if (!raw || !snapshot) continue;
      const kept = rewrite(snapshot);
      if (!kept) {
        store.removeItem(key);
        continue;
      }
      const envelope = JSON.parse(raw) as Envelope;
      const body = JSON.stringify(kept);
      if (body === envelope.body) continue;
      try {
        store.setItem(key, JSON.stringify({ ...envelope, body, check: fingerprint(body) }));
      } catch {
        // A failed rewrite cannot preserve content the engine has invalidated.
        store.removeItem(key);
      }
    }
  } catch {
    // Optional storage is never a source of deletion authority.
  }
}

export function removePublicSnapshotRows(identity: string, removed: ReadonlySet<string>): void {
  if (removed.size)
    rewritePublicSnapshots(identity, (snapshot) => withoutPublicRows(snapshot, removed));
}

export function writePublicSnapshot(
  identity: string,
  top: boolean,
  snapshot: PublicSnapshot,
): void {
  if (identity.length > 8192 || !snapshot.rows.length) return;
  const rows = snapshot.rows.slice(0, SNAPSHOT_ROWS);
  if (
    !rows.every((row) => rowKinds.has(row.kind) && snapshotSafe(row)) ||
    !rows.some((row) => row.key === snapshot.anchor)
  )
    return;
  const body = JSON.stringify({ ...snapshot, rows });
  const record = JSON.stringify({ version: 2, seen: Date.now(), body, check: fingerprint(body) });
  const key = keyFor(identity, top);
  if ((record.length + key.length) * 2 > MAX_ENTRY_BYTES) return;
  try {
    const store = backend();
    if (!store) return;
    const entries: { key: string; bytes: number; seen: number }[] = [];
    for (let i = 0; i < store.length; i++) {
      const candidate = store.key(i);
      if (!candidate?.startsWith(PREFIX) || candidate === key) continue;
      const raw = store.getItem(candidate) ?? '';
      let seen = 0;
      try {
        const value = Number((JSON.parse(raw) as Envelope).seen);
        seen = Number.isFinite(value) ? value : 0;
      } catch {
        /* damaged cache first */
      }
      entries.push({ key: candidate, bytes: (candidate.length + raw.length) * 2, seen });
    }
    entries.sort((a, b) => a.seen - b.seen);
    let bytes = entries.reduce((sum, item) => sum + item.bytes, (record.length + key.length) * 2);
    while (entries.length >= MAX_ENTRIES || bytes > MAX_BYTES) {
      const old = entries.shift();
      if (!old) break;
      store.removeItem(old.key);
      bytes -= old.bytes;
    }
    store.setItem(key, record);
  } catch {
    // Quota or unavailable storage means the already-rendered session keeps working.
  }
}

export function discardUnsaveableRows(identity: string, rows: readonly Row[]): void {
  const unsafe = rows.filter((row) => !snapshotSafe(row) || (row.kind === 'note' && row.hidden));
  if (unsafe.length) removePublicSnapshotRows(identity, new Set(unsafe.map((row) => row.key)));
}
