import { createBoundedMap } from '$lib/fp/bounded-map';

const measuredHeights = createBoundedMap<string, number>({ maxSize: 2_000 });

export type FeedRowWidthBucket =
  | '0-319'
  | '320-479'
  | '480-639'
  | '640-799'
  | '800-1023'
  | '1024+';

export function estimateFeedRowHeight(input: {
  readonly key: string;
  readonly item: unknown;
  readonly widthPx?: number;
}): number {
  const measured = measuredHeights.get(measurementKey(input));
  if (measured) return measured;
  return fallbackHeight(input.item);
}

export function recordFeedRowHeight(input: {
  readonly key: string;
  readonly widthPx?: number;
  readonly heightPx: number;
}): void {
  const height = Math.round(input.heightPx);
  if (height > 0) measuredHeights.set(measurementKey(input), height);
}

export function clearFeedRowHeightsForKey(key: string): void {
  for (const [storedKey] of measuredHeights.entries()) {
    if (storedKey.startsWith(`${key}\u0000`)) measuredHeights.delete(storedKey);
  }
}

export function feedRowHeightReservationCount(): number {
  return measuredHeights.size();
}

export function widthBucketForPx(widthPx?: number): FeedRowWidthBucket {
  const width = Math.max(0, Math.round(widthPx ?? 640));
  if (width <= 319) return '0-319';
  if (width <= 479) return '320-479';
  if (width <= 639) return '480-639';
  if (width <= 799) return '640-799';
  if (width <= 1023) return '800-1023';
  return '1024+';
}

function measurementKey(input: {
  readonly key: string;
  readonly widthPx?: number;
}): string {
  return `${input.key}\u0000${widthBucketForPx(input.widthPx)}`;
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
