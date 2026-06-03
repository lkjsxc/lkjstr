import { createBoundedMap } from '$lib/fp/bounded-map';

const measuredHeights = createBoundedMap<string, number>({ maxSize: 2_000 });

export function estimateFeedRowHeight(input: {
  readonly key: string;
  readonly item: unknown;
}): number {
  const measured = measuredHeights.get(input.key);
  if (measured) return measured;
  return fallbackHeight(input.item);
}

export function recordFeedRowHeight(input: {
  readonly key: string;
  readonly heightPx: number;
}): void {
  const height = Math.round(input.heightPx);
  if (height > 0) measuredHeights.set(input.key, height);
}

export function feedRowHeightReservationCount(): number {
  return measuredHeights.size();
}

function fallbackHeight(item: unknown): number {
  const kind = rowKind(item);
  if (kind === 'leading') return 220;
  if (kind === 'event') return 168;
  if (kind === 'empty') return 96;
  return 72;
}

function rowKind(item: unknown): string | undefined {
  if (typeof item !== 'object' || item === null) return undefined;
  const kind = (item as { readonly kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : undefined;
}
