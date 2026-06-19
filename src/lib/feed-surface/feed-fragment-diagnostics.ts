import { createBoundedMap } from '$lib/fp/bounded-map';

export type FeedFragmentDiagnostics = {
  readonly visibleFragments: number;
  readonly oversizedSemanticRows: number;
};

const oversizedRows = createBoundedMap<string, true>({ maxSize: 1_000 });
let visibleFragments = 0;

export function recordFeedFragmentMounted(): void {
  visibleFragments = Math.min(1_000, visibleFragments + 1);
}

export function recordFeedFragmentUnmounted(): void {
  visibleFragments = Math.max(0, visibleFragments - 1);
}

export function recordOversizedSemanticRow(key: string): void {
  oversizedRows.set(key, true);
}

export function feedFragmentDiagnostics(): FeedFragmentDiagnostics {
  return {
    visibleFragments,
    oversizedSemanticRows: oversizedRows.size(),
  };
}
