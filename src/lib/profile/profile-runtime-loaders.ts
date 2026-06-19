import { boundedErrorText } from '$lib/events/runtime-error';
import type { FeedCursorPoint } from '$lib/events/types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import {
  loadNewerProfilePage,
  loadOlderProfilePage,
  type ProfileOlderPreserveMode,
} from './profile-runtime-paging';
import type { ProfileState } from './profile-state';

export function createProfilePageLoaders(input: {
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly isClosed: () => boolean;
  readonly active: (run: number) => boolean;
  readonly generation: () => number;
  readonly getState: () => ProfileState;
  readonly emit: (state: ProfileState) => void;
  readonly getOlderCursor: () => FeedCursorPoint | undefined;
  readonly setOlderCursor: (cursor: FeedCursorPoint | undefined) => void;
  readonly getNewerCursor: () => FeedCursorPoint | undefined;
  readonly setNewerCursor: (cursor: FeedCursorPoint | undefined) => void;
}) {
  return {
    loadOlder: (options: { preserve?: ProfileOlderPreserveMode } = {}) =>
      loadOlder(input, options),
    loadNewer: () => loadNewer(input),
  };
}

async function loadOlder(
  input: Parameters<typeof createProfilePageLoaders>[0],
  options: { preserve?: ProfileOlderPreserveMode },
): Promise<void> {
  const state = input.getState();
  if (input.isClosed() || state.loadingOlder || !state.hasOlder) return;
  const run = input.generation();
  const cursor = input.getOlderCursor() ?? state.oldestCursor;
  if (!cursor) return;
  input.emit({ ...state, loadingOlder: true });
  try {
    const page = await loadOlderProfilePage({
      posts: input.getState().posts,
      pubkey: input.pubkey,
      relays: input.relays,
      owner: input.owner,
      cursor,
      pageSize: input.pageSize,
      subscriptions: input.subscriptions,
      signal: input.signal,
      preserve: options.preserve,
    });
    if (!input.active(run)) return;
    input.setOlderCursor(page.hasOlder ? page.nextOlderCursor : undefined);
    input.emit({
      ...input.getState(),
      posts: page.posts,
      hasOlder: page.hasOlder,
      hasNewer: input.getState().hasNewer || page.newerPruned,
      newerPruned: input.getState().newerPruned || page.newerPruned,
    });
  } catch (error) {
    input.emit({ ...input.getState(), error: boundedErrorText(error) });
  } finally {
    if (input.getState().loadingOlder) {
      input.emit({ ...input.getState(), loadingOlder: false });
    }
  }
}

async function loadNewer(
  input: Parameters<typeof createProfilePageLoaders>[0],
): Promise<void> {
  const state = input.getState();
  if (input.isClosed() || state.loadingNewer || !state.hasNewer) return;
  const run = input.generation();
  const cursor = input.getNewerCursor() ?? state.newestCursor;
  if (!cursor) return;
  input.emit({ ...state, loadingNewer: true });
  try {
    const page = await loadNewerProfilePage({
      posts: input.getState().posts,
      pubkey: input.pubkey,
      relays: input.relays,
      owner: input.owner,
      cursor,
      pageSize: input.pageSize,
      subscriptions: input.subscriptions,
      signal: input.signal,
    });
    if (!input.active(run)) return;
    input.setNewerCursor(page.hasNewer ? page.nextNewerCursor : undefined);
    input.emit({
      ...input.getState(),
      posts: page.posts,
      hasNewer: page.hasNewer,
      hasOlder: input.getState().hasOlder || page.olderPruned,
      newerPruned: page.hasNewer,
    });
  } catch (error) {
    input.emit({ ...input.getState(), error: boundedErrorText(error) });
  } finally {
    if (input.getState().loadingNewer) {
      input.emit({ ...input.getState(), loadingNewer: false });
    }
  }
}
