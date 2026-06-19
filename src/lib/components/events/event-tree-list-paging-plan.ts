import {
  canRequestOlder,
  type OlderLoadMode,
  type OlderLoadTrigger,
} from '$lib/feed-surface/older-load-mode';
import { shouldStartOlderPrefetch } from '$lib/feed-surface/older-prefetch';

export const EVENT_TREE_LIST_AUTO_FILL_ATTEMPTS = 4;

export type EventTreeListNearEndActivationInput = {
  readonly pagingEnabled?: boolean;
  readonly rowCount: number;
  readonly hasOlder?: boolean;
  readonly loadingOlder?: boolean;
  readonly hasOnNearEnd: boolean;
};

export type EventTreeListAutoFillInput = {
  readonly autoFillPending: boolean;
  readonly loadingOlder?: boolean;
  readonly hasOlder?: boolean;
  readonly attempts: number;
  readonly maxAttempts?: number;
};

export type EventTreeListAutoFillIntentInput = {
  readonly currentIntentKey?: string;
  readonly nextIntentKey?: string;
  readonly attempts: number;
};

export type EventTreeListAutoFillIntentState = {
  readonly changed: boolean;
  readonly intentKey?: string;
  readonly attempts: number;
};

export type EventTreeListOlderPrefetchInput = {
  readonly mode?: OlderLoadMode;
  readonly rowCount: number;
  readonly hasOlder?: boolean;
  readonly loadingOlder?: boolean;
  readonly cursorsReady?: boolean;
  readonly scrollOffset: number;
  readonly viewportSize: number;
  readonly scrollSize: number;
};

export type EventTreeListOlderRequestInput = {
  readonly loadingOlder?: boolean;
  readonly hasOlder?: boolean;
  readonly rowCount: number;
  readonly mode?: OlderLoadMode;
  readonly trigger: OlderLoadTrigger;
  readonly scrollable: boolean;
};

export type EventTreeListNewerCheckInput = {
  readonly pagingEnabled?: boolean;
  readonly rowCount: number;
  readonly hasNewer?: boolean;
  readonly loadingNewer?: boolean;
  readonly newerLoadPending: boolean;
};

export type EventTreeListNewerRequestInput = {
  readonly pagingEnabled?: boolean;
  readonly nearStart: boolean;
  readonly hasNewer?: boolean;
  readonly loadingNewer?: boolean;
};

export function eventTreeListNearEndEnabled(
  input: EventTreeListNearEndActivationInput,
): boolean {
  return (
    input.pagingEnabled !== false &&
    input.rowCount > 0 &&
    Boolean(input.hasOlder) &&
    !input.loadingOlder &&
    input.hasOnNearEnd
  );
}

export function canAttemptEventTreeListAutoFill(
  input: EventTreeListAutoFillInput,
): boolean {
  const maxAttempts = input.maxAttempts ?? EVENT_TREE_LIST_AUTO_FILL_ATTEMPTS;
  return (
    !input.autoFillPending &&
    !input.loadingOlder &&
    Boolean(input.hasOlder) &&
    input.attempts < maxAttempts
  );
}

export function eventTreeListAutoFillIntentState(
  input: EventTreeListAutoFillIntentInput,
): EventTreeListAutoFillIntentState {
  const changed = input.currentIntentKey !== input.nextIntentKey;
  return {
    changed,
    intentKey: changed ? input.nextIntentKey : input.currentIntentKey,
    attempts: changed ? 0 : input.attempts,
  };
}

export function shouldPrefetchEventTreeListOlder(
  input: EventTreeListOlderPrefetchInput,
): boolean {
  return shouldStartOlderPrefetch({
    mode: input.mode,
    itemCount: input.rowCount,
    hasOlder: Boolean(input.hasOlder),
    loadingOlder: Boolean(input.loadingOlder),
    cursorsReady: Boolean(input.cursorsReady),
    scrollOffset: input.scrollOffset,
    viewportSize: input.viewportSize,
    scrollSize: input.scrollSize,
  });
}

export function canRequestEventTreeListOlder(
  input: EventTreeListOlderRequestInput,
): boolean {
  return (
    !input.loadingOlder &&
    Boolean(input.hasOlder) &&
    input.rowCount > 0 &&
    canRequestOlder({
      mode: input.mode,
      trigger: input.trigger,
      userScrolledDown: input.trigger === 'scroll',
      scrollable: input.scrollable,
    })
  );
}

export function shouldScheduleEventTreeListNewerCheck(
  input: EventTreeListNewerCheckInput,
): boolean {
  return (
    input.pagingEnabled !== false &&
    input.rowCount > 0 &&
    Boolean(input.hasNewer) &&
    !input.loadingNewer &&
    !input.newerLoadPending
  );
}

export function shouldRequestEventTreeListNewer(
  input: EventTreeListNewerRequestInput,
): boolean {
  return (
    input.pagingEnabled !== false &&
    input.nearStart &&
    Boolean(input.hasNewer) &&
    !input.loadingNewer
  );
}
