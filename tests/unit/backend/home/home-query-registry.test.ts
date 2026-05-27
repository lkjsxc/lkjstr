import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homeQueryKey } from '../../../../src/lib/backend/home/home-query-key';
import {
  attachRegistryHomeQuery,
  homeQueryRegistrySize,
} from '../../../../src/lib/backend/home/home-query-registry';

const runtime = vi.hoisted(() => {
  const create = () => ({
    subscribe: vi.fn(() => () => undefined),
    start: vi.fn(async () => undefined),
    setVisibility: vi.fn(),
    loadOlder: vi.fn(async () => undefined),
    loadNewer: vi.fn(async () => undefined),
    snapshot: vi.fn(() => ({})),
    close: vi.fn(),
    items: vi.fn(() => []),
    retryFollowDiscovery: vi.fn(),
  });
  return { create, instances: [] as ReturnType<typeof create>[] };
});

vi.mock('../../../../src/lib/timeline/timeline-runtime', () => ({
  createTimelineRuntime: vi.fn(() => {
    const instance = runtime.create();
    runtime.instances.push(instance);
    return instance;
  }),
}));

describe('home query registry', () => {
  beforeEach(() => {
    runtime.instances.splice(0);
  });

  it('keys exclude tab id and normalize relays', () => {
    const key = homeQueryKey({
      accountPubkey: 'a',
      relays: ['relay.example', 'wss://relay.example/'],
      pageSize: 30,
    });
    const same = homeQueryKey({
      accountPubkey: 'a',
      relays: ['wss://relay.example/'],
      pageSize: 30,
    });
    expect(key).toBe(same);
    expect(key).not.toContain('tab');
  });

  it('shares one runtime across matching tab attachments', () => {
    const first = attach('tab-a');
    const second = attach('tab-b');
    expect(runtime.instances).toHaveLength(1);
    expect(runtime.instances[0]?.start).toHaveBeenCalledTimes(1);

    first.setVisibility(false);
    expect(runtime.instances[0]?.setVisibility).toHaveBeenLastCalledWith(true);
    second.setVisibility(false);
    expect(runtime.instances[0]?.setVisibility).toHaveBeenLastCalledWith(false);

    first.close();
    expect(runtime.instances[0]?.close).not.toHaveBeenCalled();
    second.close();
    expect(runtime.instances[0]?.close).toHaveBeenCalledTimes(1);
    expect(homeQueryRegistrySize()).toBe(0);
  });
});

function attach(tabId: string) {
  return attachRegistryHomeQuery({
    tabId,
    query: {
      accountPubkey: 'a'.repeat(64),
      relays: ['wss://relay.example/'],
      pageSize: 30,
    },
  });
}
