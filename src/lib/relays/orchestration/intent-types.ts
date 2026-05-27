import type { NostrFilter } from '../../protocol';
import type { FeedCursorPoint } from '../../events/types';
import type { DemandSurface, DemandVisibility } from './demand-types';

export type LiveIntent = {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly channel: string;
  readonly visibility: DemandVisibility;
  readonly selectedRelays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly purpose: 'feed' | 'metadata' | 'route-discovery';
  readonly since?: number;
};

export type PageIntentDirection = 'initial' | 'older' | 'newer';

export type PageIntent = {
  readonly surface: DemandSurface;
  readonly owner: string;
  readonly phase: 'bootstrap' | 'page';
  readonly selectedRelays: readonly string[];
  readonly authors: readonly string[];
  readonly pageSize: number;
  readonly direction: PageIntentDirection;
  readonly cursor?: FeedCursorPoint;
  readonly purpose?:
    | 'feed'
    | 'metadata'
    | 'route-discovery'
    | 'search'
    | 'event-lookup';
  readonly relayFilters?: readonly NostrFilter[];
  readonly routeFingerprint?: string;
  readonly filters?: (
    group: { readonly authors?: readonly string[] },
    bounds: Pick<NostrFilter, 'since' | 'until'>,
  ) => readonly NostrFilter[];
};

export type HomeNotesLiveIntent = {
  readonly surface: 'home';
  readonly owner: string;
  readonly channel: 'notes';
  readonly visibility: DemandVisibility;
  readonly selectedRelays: readonly string[];
  readonly accountPubkey: string;
  readonly authors: readonly string[];
  readonly sessionStartedAt: number;
  readonly filters: readonly NostrFilter[];
};
