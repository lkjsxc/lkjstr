import { contentTokenCacheSize } from '../events/content-tokens';
import { profileCacheSize } from '../identity/profile-cache';
import { relayDiagnosticSummaryMemorySize } from '../relays/relay-diagnostic-summary';
import {
  getMemoryCounterSnapshot,
  getMemoryCounterTotal,
  setMemoryCounter,
  type MemoryCounterKey,
} from './memory-counters';
import { orchestrationMetricsSnapshot } from '../relays/orchestration/metrics';
import { runtimeMemorySnapshot } from '../memory/runtime-memory';
import {
  activeStorageOperationCount,
  activeStorageOperationGroups,
} from '../storage/operation/tracked-operation';

export type MemoryDebugExport = {
  readonly counters: Record<MemoryCounterKey, number>;
  readonly counterTotal: number;
  readonly runtime: ReturnType<typeof runtimeMemorySnapshot>;
  readonly orchestration: ReturnType<typeof orchestrationMetricsSnapshot>;
  readonly storageOperations: ReturnType<typeof activeStorageOperationGroups>;
};

let feedWindowPeak = 0;

export function reportFeedRuntimeWindowSize(size: number): void {
  const next = Math.max(0, Math.floor(size));
  if (next > feedWindowPeak) feedWindowPeak = next;
  setMemoryCounter('feed-runtime-window-size', feedWindowPeak);
}

export function clearFeedRuntimeWindowPeak(): void {
  feedWindowPeak = 0;
  setMemoryCounter('feed-runtime-window-size', 0);
}

export function syncDerivedMemoryCounters(): void {
  setMemoryCounter('active-indexeddb-ops', activeStorageOperationCount());
  setMemoryCounter(
    'relay-diagnostic-summary-count',
    relayDiagnosticSummaryMemorySize(),
  );
  setMemoryCounter('profile-summary-cache-count', profileCacheSize());
  setMemoryCounter('token-cache-count', contentTokenCacheSize());
}

export function memoryDebugExport(): MemoryDebugExport {
  syncDerivedMemoryCounters();
  return {
    counters: getMemoryCounterSnapshot(),
    counterTotal: getMemoryCounterTotal(),
    runtime: runtimeMemorySnapshot(),
    orchestration: orchestrationMetricsSnapshot(),
    storageOperations: activeStorageOperationGroups(),
  };
}

declare global {
  interface Window {
    __lkjstrMemoryDebug?: () => MemoryDebugExport;
  }
}

export function installMemoryDebugExport(): void {
  if (typeof window === 'undefined') return;
  window.__lkjstrMemoryDebug = memoryDebugExport;
}
