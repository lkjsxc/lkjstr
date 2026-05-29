import type { RelayRouteGroup } from '../relays/relay-route-types';
import type { NostrFilter } from '../protocol';
import { buildSegmentCachePlan } from './relay-page-cache-plan';
import type { RelayGroupPageRequest } from './relay-page';
import type { RelayPageSegment } from './relay-page-segments';
import type { SegmentRead } from './relay-page-scan-types';

export async function readCachedSegment(
  request: RelayGroupPageRequest,
  group: RelayRouteGroup,
  segment: RelayPageSegment,
  baseFilters: readonly NostrFilter[],
): Promise<SegmentRead | undefined> {
  const plan = await buildSegmentCachePlan(
    request,
    group,
    segment,
    baseFilters,
  );
  return plan.kind === 'covered' ? plan.read : undefined;
}
