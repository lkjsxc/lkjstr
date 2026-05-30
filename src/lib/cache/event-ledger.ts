import type { NostrEvent } from '../protocol';
import type { EventTagRow } from '../events/types';
import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import { cacheLedgerId } from './cache-ledger-id';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type EventLedgerRecord = CacheLedgerRecord & {
  readonly ownerKind: 'event';
  readonly resourceKind: 'nostr-event';
};

export function scoreEvent(
  event: NostrEvent,
  tags: readonly EventTagRow[] = [],
): number {
  return (
    recencyBucket(event.created_at) +
    kindWeight(event.kind) +
    structuralSourceWeight(event, tags)
  );
}

export function recencyBucket(createdAt: number): number {
  return Math.floor(createdAt / 3600) * 100;
}

export function kindWeight(kind: number): number {
  if (kind === 0 || kind === 3) return 10_000;
  if (kind === 1) return 1_000;
  if (kind === 6 || kind === 16) return 800;
  if (kind === 7 || kind === 9735) return 600;
  return 300;
}

export function structuralSourceWeight(
  event: NostrEvent,
  tags: readonly EventTagRow[] = [],
): number {
  const names = [
    ...event.tags.map((tag) => tag[0]),
    ...tags.map((tag) => tag.tagName),
  ];
  return names.reduce((score, name) => {
    if (name === 'e') return score + 500;
    if (name === 'q') return score + 400;
    if (name === 'p') return score + 100;
    return score;
  }, 0);
}

export function eventTargetBumps(event: NostrEvent): Map<string, number> {
  const bumps = new Map<string, number>();
  for (const tag of event.tags) {
    const target = tag[1];
    if (!target || !['e', 'q'].includes(tag[0] ?? '')) continue;
    const kindBonus = event.kind === 9735 ? 700 : event.kind === 7 ? 300 : 500;
    bumps.set(target, Math.max(bumps.get(target) ?? 0, kindBonus));
  }
  return bumps;
}

export function eventLedgerRecord(
  event: NostrEvent,
  tags: readonly EventTagRow[] = [],
  forceProtected = false,
  cacheBytes = 0,
  updatedAt = Date.now(),
): EventLedgerRecord {
  return {
    id: cacheLedgerId('event', event.id),
    ownerKind: 'event',
    resourceKind: 'nostr-event',
    resourceId: event.id,
    score: scoreEvent(event, tags),
    createdAt: event.created_at,
    protected: forceProtected,
    cacheBytes,
    updatedAt,
  };
}

export async function upsertEventLedger(
  event: NostrEvent,
  tags: readonly EventTagRow[] = [],
  forceProtected = false,
  cacheBytes = 0,
  updatedAt = Date.now(),
): Promise<void> {
  if (!indexedDbAvailable()) return;
  await browserDb().cacheLedger.put(
    eventLedgerRecord(event, tags, forceProtected, cacheBytes, updatedAt),
  );
  await bumpEventTargets(event);
}

async function bumpEventLedger(eventId: string, delta: number): Promise<void> {
  if (!indexedDbAvailable()) return;
  const existing = await browserDb().cacheLedger.get(
    cacheLedgerId('event', eventId),
  );
  if (!existing || existing.protected) return;
  await browserDb().cacheLedger.put({
    ...existing,
    score: existing.score + delta,
    updatedAt: Date.now(),
  });
}

async function bumpEventTargets(event: NostrEvent): Promise<void> {
  await Promise.all(
    [...eventTargetBumps(event)].map(([eventId, delta]) =>
      bumpEventLedger(eventId, delta),
    ),
  );
}
