import { generateSecretKey, getPublicKey } from '../../../src/lib/protocol';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { createRelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import { managerAsOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import {
  createTimelineRuntime,
  type TimelineRuntime,
} from '../../../src/lib/timeline/timeline-runtime';
import { FakeWebSocket, sockets } from './fake-websocket';

export { FakeWebSocket, sockets };

export function runtimeFor(options: {
  activeAccountPubkey: string;
  relays?: readonly string[];
}): TimelineRuntime {
  const pool = createRelayPool();
  return createTimelineRuntime({
    relays: options.relays ?? ['relay.example'],
    subId: 'timeline-test',
    owner: 'timeline-test',
    activeAccountPubkey: options.activeAccountPubkey,
    pool,
    subscriptions: managerAsOrchestrator(createRelaySubscriptionManager(pool), {
      keyPrefix: 'timeline-test',
    }),
  });
}

export function pubkey(): string {
  return getPublicKey(generateSecretKey());
}

export function findFollowsReq(active: string): unknown[] | undefined {
  for (const socket of sockets) {
    for (const raw of socket.sent) {
      const msg = JSON.parse(raw) as unknown[];
      if (msg[0] !== 'REQ') continue;
      const filter = msg[2] as {
        kinds?: number[];
        authors?: string[];
        limit?: number;
      };
      if (!filter?.kinds?.includes(3)) continue;
      if (filter.limit !== 1) continue;
      if (!filter.authors?.includes(active)) continue;
      return msg;
    }
  }
  return undefined;
}

export function followsSubId(
  socket: FakeWebSocket,
  active: string,
): string | undefined {
  for (const raw of socket.sent) {
    const msg = JSON.parse(raw) as unknown[];
    if (msg[0] !== 'REQ') continue;
    const filter = msg[2] as {
      kinds?: number[];
      authors?: string[];
      limit?: number;
    };
    if (!filter?.kinds?.includes(3)) continue;
    if (filter.limit !== 1) continue;
    if (!filter.authors?.includes(active)) continue;
    return String(msg[1]);
  }
  return undefined;
}
