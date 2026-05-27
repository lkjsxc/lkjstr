import { incMemoryCounter } from '$lib/app/memory-counters';
import { reportFeedRuntimeWindowSize } from '$lib/app/memory-debug';
import {
  countRuntime,
  setRuntimeCounterActive,
} from '$lib/app/runtime-counters';
import { appendAppLog } from '$lib/log/app-log';
import { attachHomeQuery } from '$lib/backend/home/home-query';
import {
  createGlobalTimelineRuntime,
  type GlobalTimelineRuntime,
} from '$lib/timeline/global-timeline-runtime';
import { type TimelineRuntime } from '$lib/timeline/timeline-runtime';
import type {
  TimelineRuntimeOptions,
  TimelineState,
} from '$lib/timeline/timeline-state';
import { createTimelineSubId } from '$lib/timeline/timeline-subscription';

export function createBoundTimelineTabRuntime(input: {
  readonly tabId: string;
  readonly kind?: 'home' | 'global';
  readonly relays: readonly string[];
  readonly activeAccountPubkey?: string | null;
  readonly seed: TimelineRuntimeOptions['seed'];
  readonly onState: (state: TimelineState) => void;
}): {
  readonly runtime: TimelineRuntime | GlobalTimelineRuntime;
  readonly unsubscribe: () => void;
} {
  const options = {
    relays: input.relays,
    owner: input.tabId,
    subId: createTimelineSubId(
      input.tabId,
      input.kind === 'global' ? 'global' : 'tl',
    ),
    kind: input.kind,
    activeAccountPubkey: input.activeAccountPubkey,
    seed: input.seed,
  };
  incMemoryCounter('active-tab-runtimes');
  const runtime =
    input.kind === 'global'
      ? createGlobalTimelineRuntime(options)
      : attachHomeQuery({
          tabId: input.tabId,
          relays: input.relays,
          activeAccountPubkey: input.activeAccountPubkey,
          seed: input.seed,
        });
  appendAppLog({
    area: 'runtime',
    severity: 'info',
    code: 'timeline-runtime-create',
    message: 'Timeline runtime created.',
    context: {
      tabId: input.tabId,
      kind: input.kind ?? 'home',
      relays: input.relays.length,
      reason: 'create',
    },
  });
  if (input.kind === 'global') {
    countRuntime('timeline:global', 'created');
    setRuntimeCounterActive('timeline:global', 1);
  } else {
    countRuntime('timeline:home', 'created');
    setRuntimeCounterActive('timeline:home', 1);
  }
  const unsubscribe = runtime.subscribe((next) => {
    input.onState(next);
    reportFeedRuntimeWindowSize(next.items.length);
  });
  void runtime.start();
  return { runtime, unsubscribe };
}
