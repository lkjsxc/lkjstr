import type { RelaySubscriptionManager } from '../subscription-manager';
import type { ReadPageOptions } from '../subscription-manager-types';
import type { ReadPageResult } from '../read-page-status';
import type { PoolEvent } from '../relay-pool';
import type { Demand } from './demand-types';
import type { OrchestrationMetrics } from './metrics';

export type SubscriptionOrchestrator = RelaySubscriptionManager & {
  readonly subscribeDemand: (
    demand: Demand,
    listener: (event: PoolEvent) => void,
  ) => () => void;
  readonly readDemandPage: (
    demand: Demand,
    options?: ReadPageOptions,
  ) => Promise<ReadPageResult>;
  readonly pauseOwner: (owner: string) => void;
  readonly resumeOwner: (owner: string) => void;
  readonly releaseOwner: (owner: string) => void;
  readonly metricsSnapshot: () => OrchestrationMetrics;
};
