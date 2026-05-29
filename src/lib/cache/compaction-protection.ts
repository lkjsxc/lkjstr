import Dexie from 'dexie';
import { browserDb } from '../storage/browser-db';
import { pinnedEventIds } from './pins';

export type CompactionEventCandidate = {
  readonly id: string;
  readonly pubkey: string;
  readonly kind: number;
  readonly created_at: number;
};

export function latestEventIdsByPubkey(
  events: readonly CompactionEventCandidate[],
  kind: number,
  wantedPubkeys?: ReadonlySet<string>,
): Set<string> {
  const latestByPubkey = new Map<string, CompactionEventCandidate>();
  for (const event of events) {
    if (event.kind !== kind) continue;
    if (wantedPubkeys && !wantedPubkeys.has(event.pubkey)) continue;
    const current = latestByPubkey.get(event.pubkey);
    if (!current || event.created_at > current.created_at)
      latestByPubkey.set(event.pubkey, event);
  }
  return new Set([...latestByPubkey.values()].map((event) => event.id));
}

export async function protectedEventIds(): Promise<Set<string>> {
  const ids = pinnedEventIds();
  await collectLatestByKindPubkey(0, ids);
  const accountPubkeys = await loadAccountPubkeys();
  if (accountPubkeys.size > 0)
    await collectLatestByKindPubkeyForSet(3, accountPubkeys, ids);
  await browserDb()
    .eventPriority.filter((row) => row.protected)
    .each((row) => ids.add(row.id));
  return ids;
}

async function loadAccountPubkeys(): Promise<Set<string>> {
  const pubkeys = new Set<string>();
  await browserDb().accounts.each((account) => pubkeys.add(account.pubkey));
  return pubkeys;
}

async function collectLatestByKindPubkey(
  kind: number,
  target: Set<string>,
): Promise<void> {
  const events = await eventsByKind(kind);
  for (const id of latestEventIdsByPubkey(events, kind)) target.add(id);
}

async function collectLatestByKindPubkeyForSet(
  kind: number,
  wantedPubkeys: Set<string>,
  target: Set<string>,
): Promise<void> {
  const events = await eventsByKind(kind);
  for (const id of latestEventIdsByPubkey(events, kind, wantedPubkeys))
    target.add(id);
}

async function eventsByKind(kind: number): Promise<CompactionEventCandidate[]> {
  const events: CompactionEventCandidate[] = [];
  await browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between(
      [Dexie.minKey, kind, Dexie.minKey],
      [Dexie.maxKey, kind, Dexie.maxKey],
    )
    .each((event) => events.push(event));
  return events;
}
