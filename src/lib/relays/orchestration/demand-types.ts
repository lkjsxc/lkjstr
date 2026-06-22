import type { NostrFilter } from '../../protocol';
import type { RelayRequestPurpose } from '../relay-request-compat';

export type DemandPhase = 'bootstrap' | 'live' | 'page';

export type DemandSurface =
  | 'home'
  | 'global'
  | 'profile'
  | 'thread'
  | 'notifications'
  | 'user-timeline'
  | 'search'
  | 'custom-request'
  | 'author-context'
  | 'public-chat';

export type DemandVisibility = 'visible' | 'hidden';

export type DemandPriority = 'high' | 'normal' | 'low';

export type Demand = {
  readonly surface: DemandSurface;
  readonly phase: DemandPhase;
  readonly relays: readonly string[];
  readonly filters: readonly NostrFilter[];
  readonly purpose: RelayRequestPurpose;
  readonly owner: string;
  readonly visibility: DemandVisibility;
  readonly priority?: DemandPriority;
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
  readonly stalenessMs?: number;
  /** Disambiguates multiple live demands per owner (for example notes vs metadata). */
  readonly channel?: string;
};

export const defaultDemandStalenessMs = 120_000;
