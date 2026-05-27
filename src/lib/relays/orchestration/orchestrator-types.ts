import type { RelaySubscriptionManager } from '../subscription-manager';
import type { ReadPageOptions } from '../subscription-manager-types';
import type { ReadPageResult } from '../read-page-status';
import type { PoolEvent } from '../relay-pool';
import type { Demand } from './demand-types';
import type {
  HomeNotesLiveIntent,
  LiveIntent,
  PageIntent,
} from './intent-types';
import type { OrchestrationMetrics } from './metrics';

export type SubscriptionOrchestrator = Pick<
  RelaySubscriptionManager,
  'subscribeState' | 'readPage' | 'readPageDetailed' | 'close' | 'counts'
> & {
  readonly subscribeDemand: (
    demand: Demand,
    listener: (event: PoolEvent) => void,
  ) => () => void;
  readonly submitLiveIntent: (
    intent: LiveIntent,
    relays: readonly string[],
    listener: (event: PoolEvent) => void,
  ) => () => void;
  readonly submitHomeNotesLiveIntent: (
    intent: HomeNotesLiveIntent,
    listener: (event: PoolEvent) => void,
  ) => Promise<() => void>;
  readonly readPageByIntent: (
    intent: PageIntent,
    options?: ReadPageOptions,
  ) => Promise<ReadPageResult>;
  readonly readDemandPage: (
    demand: Demand,
    options?: ReadPageOptions,
  ) => Promise<ReadPageResult>;
  readonly pauseOwner: (owner: string) => void;
  readonly resumeOwner: (owner: string) => void;
  readonly releaseOwner: (owner: string) => void;
  readonly metricsSnapshot: () => OrchestrationMetrics;
};

export type PageReadExecutor = Pick<
  SubscriptionOrchestrator,
  'readPageDetailed'
>;
