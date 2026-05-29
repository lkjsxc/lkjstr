import type { EventPriorityRecord } from './event-priority';
import { browserDb } from '../storage/browser-db';

export function selectPruneIds(
  rows: readonly EventPriorityRecord[],
  protectedIds: ReadonlySet<string>,
  needed: number,
): string[] {
  return selectPruneRows(rows, protectedIds, needed).map((row) => row.id);
}

export function selectPruneRows(
  rows: readonly EventPriorityRecord[],
  protectedIds: ReadonlySet<string>,
  needed: number,
): EventPriorityRecord[] {
  return rows
    .filter((row) => isPrunablePriorityRow(row, protectedIds))
    .sort((a, b) => a.score - b.score)
    .slice(0, needed);
}

export function isPrunablePriorityRow(
  row: EventPriorityRecord,
  protectedIds: ReadonlySet<string>,
): boolean {
  return !protectedIds.has(row.id) && !row.protected;
}

export async function lowestScorePruneRows(
  needed: number,
  protectedIds: Set<string>,
): Promise<EventPriorityRecord[]> {
  const rows: EventPriorityRecord[] = [];
  await browserDb()
    .eventPriority.orderBy('score')
    .each((row: EventPriorityRecord) => {
      if (rows.length >= needed) return false;
      if (isPrunablePriorityRow(row, protectedIds)) rows.push(row);
    });
  return rows;
}
