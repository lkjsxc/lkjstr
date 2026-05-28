import type { DemandVisibility } from '../relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { LiveDemandHandles } from '../relays/orchestration/live-demand-handles';
import type { FeedCursorPoint } from '../events/types';
import { createTimelineRuntimeNetwork } from './timeline-runtime-network';
import type { TimelineNetworkCtx } from './timeline-runtime-network-types';
import type { TimelineLoad } from './timeline-load';
import type { TimelineState } from './timeline-state';
import type { TimelineItem } from './timeline-store';
import { timelineSessionStartedAt } from './timeline-session-started-at';

export type TimelineRuntimeBindInput = {
  surface: 'home' | 'global';
  owner: string;
  subscriptions: SubscriptionOrchestrator;
  relays: readonly string[];
  pageSize: number;
  noteSubId: string;
  metaSubId: string;
  followSubId: string;
  activeAccountPubkey?: string | null;
  cleanup: () => (() => void)[];
  signal: AbortSignal;
  visibility: () => DemandVisibility;
  isClosed: () => boolean;
  isActive: (run: number) => boolean;
  getGeneration: () => number;
  items: () => TimelineItem[];
  getState: () => TimelineState;
  emit: (next: TimelineState) => void;
  nextState: (patch: Partial<TimelineState>) => TimelineState;
  getAuthors: () => string[];
  setAuthors: (v: string[]) => void;
  getProfiles: () => TimelineState['profiles'];
  setProfiles: (v: TimelineState['profiles']) => void;
  getFollowList: () => TimelineLoad['followList'];
  setFollowList: (v: TimelineLoad['followList']) => void;
  getFollowListId: () => string;
  setFollowListId: (v: string) => void;
  setFollowFallbackStarted: (v: boolean) => void;
  getFollowFallbackStarted: () => boolean;
  getCached: () => TimelineItem[];
  setCached: (v: TimelineItem[]) => void;
  clearLive: () => void;
  getOlderScanCursor: () => FeedCursorPoint | undefined;
  setOlderScanCursor: (v: FeedCursorPoint | undefined) => void;
  getInitialNotesKey: () => string;
  setInitialNotesKey: (v: string) => void;
  routeRefresh: TimelineNetworkCtx['routeRefresh'];
  liveHandles: LiveDemandHandles;
  applyLoaded: (loaded: TimelineLoad) => void;
  withCursors: (next: TimelineState) => TimelineState;
  setLive: (v: TimelineItem[]) => void;
  getLive: () => TimelineItem[];
};

export function bindTimelineRuntimeNetwork(input: TimelineRuntimeBindInput) {
  const ctx: TimelineNetworkCtx = {
    surface: input.surface,
    owner: input.owner,
    subscriptions: input.subscriptions,
    relays: input.relays,
    pageSize: input.pageSize,
    noteSubId: input.noteSubId,
    metaSubId: input.metaSubId,
    followSubId: input.followSubId,
    setProfiles: input.setProfiles,
    startedAt: timelineSessionStartedAt(
      input.surface,
      input.activeAccountPubkey ?? undefined,
      input.relays,
    ),
    activeAccountPubkey: input.activeAccountPubkey,
    cleanup: input.cleanup,
    signal: input.signal,
    visibility: input.visibility,
    isClosed: input.isClosed,
    isActive: input.isActive,
    getGeneration: input.getGeneration,
    items: input.items,
    getState: input.getState,
    emit: input.emit,
    nextState: input.nextState,
    getAuthors: input.getAuthors,
    setAuthors: input.setAuthors,
    getProfiles: input.getProfiles,
    getFollowList: input.getFollowList,
    setFollowList: input.setFollowList,
    getFollowListId: input.getFollowListId,
    setFollowListId: input.setFollowListId,
    setFollowFallbackStarted: input.setFollowFallbackStarted,
    getFollowFallbackStarted: input.getFollowFallbackStarted,
    getCached: input.getCached,
    setCached: input.setCached,
    clearLive: input.clearLive,
    getOlderScanCursor: input.getOlderScanCursor,
    setOlderScanCursor: input.setOlderScanCursor,
    getInitialNotesKey: input.getInitialNotesKey,
    setInitialNotesKey: input.setInitialNotesKey,
    routeRefresh: input.routeRefresh,
    liveHandles: input.liveHandles,
    applyLoaded: input.applyLoaded,
    withCursors: input.withCursors,
    setLive: input.setLive,
    getLive: input.getLive,
  };
  return createTimelineRuntimeNetwork(ctx);
}
