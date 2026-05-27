import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appLogRecords,
  clearAppLogForTests,
} from '../../../src/lib/log/app-log';
import { createBoundTimelineTabRuntime } from '../../../src/lib/tabs/timeline/timeline-tab-runtime-create';

const runtime = vi.hoisted(() => {
  const create = () => ({
    subscribe: vi.fn(() => () => undefined),
    start: vi.fn(() => Promise.reject(new Error('runtime denied'))),
    setVisibility: vi.fn(),
    close: vi.fn(),
    loadOlder: vi.fn(),
    loadNewer: vi.fn(),
    snapshot: vi.fn(() => ({})),
    items: vi.fn(() => []),
  });
  return {
    create,
    home: [] as ReturnType<typeof create>[],
    global: [] as ReturnType<typeof create>[],
  };
});

vi.mock('$lib/app/memory-counters', () => ({ incMemoryCounter: vi.fn() }));
vi.mock('$lib/app/memory-debug', () => ({
  reportFeedRuntimeWindowSize: vi.fn(),
}));
vi.mock('$lib/app/runtime-counters', () => ({
  countRuntime: vi.fn(),
  setRuntimeCounterActive: vi.fn(),
}));
vi.mock('$lib/backend/home/home-query', () => ({
  attachHomeQuery: vi.fn(() => {
    const instance = runtime.create();
    runtime.home.push(instance);
    return instance;
  }),
}));
vi.mock('$lib/timeline/global-timeline-runtime', () => ({
  createGlobalTimelineRuntime: vi.fn(() => {
    const instance = runtime.create();
    runtime.global.push(instance);
    return instance;
  }),
}));

describe('timeline tab runtime startup', () => {
  beforeEach(() => {
    runtime.home.splice(0);
    runtime.global.splice(0);
    clearAppLogForTests();
  });

  it('logs rejected Home startup promises with bounded context', async () => {
    createBoundTimelineTabRuntime({
      tabId: 'home-tab',
      relays: ['wss://relay.example'],
      activeAccountPubkey: 'a'.repeat(64),
      seed: undefined,
      onState: vi.fn(),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runtime.home[0]?.start).toHaveBeenCalledTimes(1);
    expect(startFailure()).toMatchObject({
      code: 'timeline-runtime-start-failed',
      message: 'runtime denied',
      context: {
        surface: 'timeline',
        kind: 'home',
        tabId: 'home-tab',
        relayCount: 1,
      },
    });
  });

  it('logs rejected Global startup promises with bounded context', async () => {
    createBoundTimelineTabRuntime({
      tabId: 'global-tab',
      kind: 'global',
      relays: ['wss://relay.example', 'wss://relay-two.example'],
      activeAccountPubkey: undefined,
      seed: undefined,
      onState: vi.fn(),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runtime.global[0]?.start).toHaveBeenCalledTimes(1);
    expect(startFailure()).toMatchObject({
      code: 'timeline-runtime-start-failed',
      context: {
        surface: 'timeline',
        kind: 'global',
        tabId: 'global-tab',
        relayCount: 2,
      },
    });
  });
});

function startFailure() {
  return appLogRecords().find(
    (record) => record.code === 'timeline-runtime-start-failed',
  );
}
