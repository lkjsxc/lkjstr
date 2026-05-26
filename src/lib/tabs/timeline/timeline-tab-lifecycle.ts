import { decMemoryCounter } from '$lib/app/memory-counters';
import { countRuntime, setRuntimeCounterActive } from '$lib/app/runtime-counters';
import { appendAppLog } from '$lib/log/app-log';
import { consumeTabCloseReason } from '$lib/workspace/tab-lifecycle-reasons';
import type { TimelineState } from '$lib/timeline/timeline-state';

export function closeTimelineTabRuntime(args: {
  readonly tabId: string;
  readonly kind?: 'home' | 'global';
  readonly code: string;
  readonly runtimeStartedAt: number;
  readonly state: TimelineState;
  readonly relays: string[];
  readonly close: () => void;
  readonly clearUnsubscribe: () => void;
}): void {
  args.close();
  args.clearUnsubscribe();
  decMemoryCounter('active-tab-runtimes');
  const reason =
    args.code === 'timeline-runtime-destroy'
      ? consumeTabCloseReason(args.tabId)
      : args.code;
  appendAppLog({
    area: 'runtime',
    severity: 'info',
    code: args.code,
    message: 'Timeline runtime closed.',
    context: {
      tabId: args.tabId,
      kind: args.kind ?? 'home',
      relays: args.relays.length,
      reason,
      uptimeMs: args.runtimeStartedAt ? Date.now() - args.runtimeStartedAt : 0,
      itemCount: args.state.items.length,
      connectedRelays: args.state.connectedRelays,
      eoseRelays: args.state.eoseRelays,
    },
  });
  if (args.kind === 'global') {
    countRuntime('timeline:global', 'closed');
    setRuntimeCounterActive('timeline:global', -1);
  } else {
    countRuntime('timeline:home', 'closed');
    setRuntimeCounterActive('timeline:home', -1);
  }
}
