import { runtimeCounterSnapshots } from '../app/runtime-counters';
import { contentTokenCacheSize } from '../events/content-tokens';
import { fallbackRepositoryCounts } from '../events/repository-memory';
import { feedFragmentDiagnostics } from '../feed-surface/feed-fragment-diagnostics';
import { referenceCacheSize } from '../events/reference-resolver';
import { profileCacheSize } from '../identity/profile-cache';
import { feedGeometryWasmBridgeStatus } from '../feed-surface/feed-geometry-wasm';
import { feedRowHeightDiagnostics } from '../feed-surface/row-height-reservation';
import { appLogCount } from '../log/app-log';
import { relayDiagnosticSuppressionCount } from '../relays/relay-diagnostic-log';
import { currentRelaySnapshots } from '../relays/session-snapshots';
import { orchestrationMetricsSnapshot } from '../relays/orchestration/metrics';
import { sharedSubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import {
  unavailableFeedGeometryDiagnostics,
  type FeedGeometryRuntimeDiagnostics,
} from './feed-geometry-diagnostics';
import {
  unavailableUserTimelineDiagnostics,
  type UserTimelineRuntimeDiagnostics,
} from './user-timeline-diagnostics';

export type RuntimeMemorySnapshot = {
  readonly runtimeCounters: ReturnType<typeof runtimeCounterSnapshots>;
  readonly appLogCount: number;
  readonly relaySuppressionCount: number;
  readonly relaySnapshots: {
    readonly count: number;
    readonly open: number;
    readonly activeSubscriptions: number;
  };
  readonly subscriptions: ReturnType<
    typeof sharedSubscriptionOrchestrator.counts
  >;
  readonly orchestration: ReturnType<typeof orchestrationMetricsSnapshot>;
  readonly fallbackRepository: ReturnType<typeof fallbackRepositoryCounts>;
  readonly caches: {
    readonly references: number;
    readonly profiles: number;
    readonly contentTokens: number;
  };
  readonly geometry: ReturnType<typeof feedRowHeightDiagnostics> & {
    readonly bridgeStatus: string;
    readonly rust: FeedGeometryRuntimeDiagnostics;
    readonly fragments: ReturnType<typeof feedFragmentDiagnostics>;
  };
  readonly userTimeline: UserTimelineRuntimeDiagnostics;
  readonly jsHeap?: {
    readonly usedJSHeapSize: number;
    readonly totalJSHeapSize: number;
    readonly jsHeapSizeLimit: number;
  };
};

export function runtimeMemorySnapshot(
  userTimeline = unavailableUserTimelineDiagnostics(
    'Rust User Timeline diagnostics bridge has not loaded.',
  ),
  feedGeometry = unavailableFeedGeometryDiagnostics(
    'Rust feed geometry diagnostics bridge has not loaded.',
  ),
): RuntimeMemorySnapshot {
  const snapshots = currentRelaySnapshots();
  return {
    runtimeCounters: runtimeCounterSnapshots(),
    appLogCount: appLogCount(),
    relaySuppressionCount: relayDiagnosticSuppressionCount(),
    relaySnapshots: {
      count: snapshots.length,
      open: snapshots.filter((snapshot) => snapshot.state === 'open').length,
      activeSubscriptions: snapshots.reduce(
        (sum, snapshot) =>
          sum + (snapshot.stats?.activeSubscriptionIds.length ?? 0),
        0,
      ),
    },
    subscriptions: sharedSubscriptionOrchestrator.counts(),
    orchestration: orchestrationMetricsSnapshot(),
    fallbackRepository: fallbackRepositoryCounts(),
    caches: {
      references: referenceCacheSize(),
      profiles: profileCacheSize(),
      contentTokens: contentTokenCacheSize(),
    },
    geometry: {
      bridgeStatus: feedGeometryWasmBridgeStatus().status,
      rust: feedGeometry,
      fragments: feedFragmentDiagnostics(),
      ...feedRowHeightDiagnostics(),
    },
    userTimeline,
    jsHeap: jsHeapSnapshot(),
  };
}

function jsHeapSnapshot(): RuntimeMemorySnapshot['jsHeap'] {
  const memory = (
    globalThis.performance as
      | (Performance & {
          readonly memory?: {
            readonly usedJSHeapSize: number;
            readonly totalJSHeapSize: number;
            readonly jsHeapSizeLimit: number;
          };
        })
      | undefined
  )?.memory;
  return memory
    ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      }
    : undefined;
}
