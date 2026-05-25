import type { NostrEvent } from '../protocol';
import type { EventTagRow } from '../events/types';
import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import { pinnedEventIds } from './pins';

export type EventPriorityRecord = {
  readonly id: string;
  readonly score: number;
  readonly createdAt: number;
  readonly protected: boolean;
};

export const cacheEventBudget = 5000;

export function scoreEvent(
  event: NostrEvent,
  tags: readonly EventTagRow[] = [],
): number {
  let score = event.created_at;
  const names = [
    ...event.tags.map((tag) => tag[0]),
    ...tags.map((tag) => tag.tagName),
  ];
  for (const name of names) {
    if (name === 'e') score += 50;
    if (name === 'p') score += 10;
    if (name === 'q') score += 40;
  }
  if (event.kind === 6 || event.kind === 16) score += 30;
  if (event.kind === 7 || event.kind === 9735) score += 20;
  return score;
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
    protected:
      forceProtected ||
      isHardProtectedKind(event) ||
      pinnedEventIds().has(event.id),
  };
  await browserDb().eventPriority.put(record);
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
