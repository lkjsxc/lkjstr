// At most a head and an older-page subscription, and the engine's 8000-message private retention bound.
import type { DmMessage, DmSnapshot } from '../engine/protocol.ts';
import { dmSubscription } from './dm-subscription.ts';
import { dmVisible } from './dm-surface.ts';
import type { ViewEnv } from './registry.ts';

export function createDmStream(o: {
  env: ViewEnv;
  account: string;
  peers: readonly string[];
  changed(): void;
}) {
  let snapshot: DmSnapshot | undefined,
    room: string | undefined,
    stopped = false,
    loading = false;
  let head: ReturnType<typeof dmSubscription> | undefined,
    page: ReturnType<typeof dmSubscription> | undefined;
  let pageBefore = '',
    pageLast = '',
    waiting = false;
  const records = new Map<string, DmMessage>(); // <=8000, same as the private engine inbox
  let rows: readonly DmMessage[] = [];
  const authors = new Map<string, NonNullable<DmSnapshot['people']>[number]>(); // <=2048 public models
  const same = (keys: readonly string[]): boolean => {
    const a = [...new Set([o.account, ...o.peers])].sort(),
      b = [...new Set(keys)].sort();
    return a.length === b.length && a.every((key, i) => key === b[i]);
  };
  const accept = (value: DmSnapshot, old: boolean): void => {
    if (stopped) return;
    for (const author of value.people ?? []) {
      if (authors.size < 2048 || authors.has(author.pubkey)) authors.set(author.pubkey, author);
    }
    room ??= value.conversation;
    for (const message of value.messages) records.set(message.id, message);
    rows = [...records.values()]
      .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
      .slice(0, 8000);
    const kept = new Set(rows.map((m) => m.id));
    for (const id of records.keys()) if (!kept.has(id)) records.delete(id);
    if (!snapshot || old || !page) snapshot = value;
    else
      snapshot = {
        ...snapshot,
        people: value.people,
        blocked: value.blocked,
        undecryptable: value.undecryptable,
        ...(value.phase === 'failed' ? { phase: value.phase, error: value.error } : {}),
      };
    if (old || !page) {
      const tail = value.messages.at(-1)?.id ?? '';
      if (
        tail !== pageLast ||
        value.phase === 'live' ||
        value.phase === 'failed' ||
        value.phase === 'unsupported'
      )
        waiting = false;
      pageLast = tail;
    }
    loading = !!waiting;
    o.changed();
  };
  const openHead = (): void => {
    head?.close();
    head = dmSubscription(
      o.env,
      {
        account: o.account,
        ...(room ? { conversation: room } : { participants: o.peers }),
        limit: 100,
      },
      (value) => accept(value, false),
    );
  };
  const open = (): void => {
    head?.close();
    page?.close();
    page = undefined;
    room = undefined;
    snapshot = undefined;
    records.clear();
    rows = [];
    authors.clear();
    loading = waiting = false;
    pageBefore = pageLast = '';
    if ((o.env.engine.info.get()?.version ?? 0) >= 8) openHead();
    else
      head = dmSubscription(o.env, { account: o.account, limit: 100 }, (value) => {
        if (stopped) return;
        const found = value.conversations.find((c) => same(c.participants));
        if (found) {
          room = found.key;
          openHead();
        } else {
          snapshot = { ...value, conversations: [], messages: [], more: false };
          o.changed();
        }
      });
    o.changed();
  };
  const more = (): void => {
    if (stopped || !dmVisible(o.env) || waiting || !room || rows.length >= 8000 || !snapshot?.more)
      return;
    const oldest = rows.at(-1)?.id;
    if (!oldest) {
      waiting = loading = true;
      head?.more();
      o.changed();
      return;
    }
    waiting = loading = true;
    if (oldest !== pageBefore) {
      page?.close();
      pageBefore = oldest;
      pageLast = '';
      page = dmSubscription(
        o.env,
        { account: o.account, conversation: room, before: oldest, limit: 100 },
        (value) => accept(value, true),
      );
    } else page?.more();
    o.changed();
  };
  queueMicrotask(() => {
    if (!stopped) open();
  });
  return {
    open,
    more,
    rows: () => rows,
    snapshot: () => (snapshot ? { ...snapshot, people: [...authors.values()] } : undefined),
    loading: () => loading,
    room: () => room,
    known: (id: string) => records.get(id),
    ackSeen(ids: readonly string[]): void {
      for (const id of ids) {
        const row = records.get(id);
        if (row?.unread) records.set(id, { ...row, unread: false });
      }
      rows = rows.map((row) => records.get(row.id) ?? row);
    },
    dispose(): void {
      stopped = true;
      head?.close();
      page?.close();
      records.clear();
      rows = [];
      authors.clear();
      snapshot = undefined;
    },
  };
}
