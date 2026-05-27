import type { NostrEvent } from '../protocol';
import type { EventTagRow } from '../events/types';
import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';

export type EventPriorityRecord = {
  readonly id: string;
  readonly score: number;
  readonly createdAt: number;
  readonly protected: boolean;
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

export function priorityTargetBumps(event: NostrEvent): Map<string, number> {
  const bumps = new Map<string, number>();
  for (const tag of event.tags) {
    const target = tag[1];
    if (!target || !['e', 'q'].includes(tag[0] ?? '')) continue;
    const kindBonus = event.kind === 9735 ? 700 : event.kind === 7 ? 300 : 500;
    bumps.set(target, Math.max(bumps.get(target) ?? 0, kindBonus));
  }
  return bumps;
}

export function isHardProtectedKind(event: NostrEvent): boolean {
  return event.kind === 0 || event.kind === 3;
}

export async function upsertEventPriority(
  event: NostrEvent,
  tags: readonly EventTagRow[] = [],
  forceProtected = false,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  const record: EventPriorityRecord = {
    id: event.id,
    score: scoreEvent(event, tags),
    createdAt: event.created_at,
    protected: forceProtected || isHardProtectedKind(event),
  };
  await browserDb().eventPriority.put(record);
  await bumpEventTargets(event);
}

export async function bumpEventPriority(
  eventId: string,
  delta: number,
): Promise<void> {
  if (!indexedDbAvailable()) return;
  const existing = await browserDb().eventPriority.get(eventId);
  if (!existing || existing.protected) return;
  await browserDb().eventPriority.put({
    ...existing,
    score: existing.score + delta,
  });
}

async function bumpEventTargets(event: NostrEvent): Promise<void> {
  await Promise.all(
    [...priorityTargetBumps(event)].map(([eventId, delta]) =>
      bumpEventPriority(eventId, delta),
    ),
  );
}
