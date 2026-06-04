import type { RelayGroupPageRequest } from './relay-page';
import type { ScanModelContext } from '$lib/feed-surface/scan-model-records';

export function scanContextForRelay(input: {
  readonly request: RelayGroupPageRequest;
  readonly groupKey: string;
  readonly relayUrl: string;
  readonly filterKey: string;
  readonly direction: 'older' | 'newer';
}): ScanModelContext {
  return {
    semanticFeedKey: scanSemanticKey(input.request),
    routeGroupKey: input.groupKey,
    relayUrl: input.relayUrl,
    semanticFilterKey: input.filterKey,
    direction: input.direction,
    routeFingerprint: input.request.routeFingerprint ?? input.request.key,
  };
}

export function scanSemanticKey(request: RelayGroupPageRequest): string {
  return request.semanticFeedKey ?? request.key;
}

export function scanEdge(input: {
  readonly request: RelayGroupPageRequest;
  readonly direction: 'older' | 'newer';
  readonly nowMs: number;
}): { readonly edgeSeconds: number; readonly edgeId: string } {
  const cursor =
    input.direction === 'newer' ? input.request.after : input.request.before;
  if (cursor) return { edgeSeconds: cursor.createdAt, edgeId: cursor.id };
  if (input.direction === 'newer')
    return { edgeSeconds: input.request.since ?? 0, edgeId: 'since-bound' };
  return {
    edgeSeconds: input.request.until ?? Math.floor(input.nowMs / 1000),
    edgeId: 'until-bound',
  };
}
