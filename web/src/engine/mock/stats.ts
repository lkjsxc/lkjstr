// Additive engine stats mirror for the in-memory test double.
import type { EngineStats } from '../protocol.ts';
import type { Core } from './engine.ts';
import { relays } from './relays.ts';
export function mockStats(core: Core): EngineStats {
  return {
    relays: relays(core.world).map((r) => ({
      url: r.url,
      state: r.state,
      connectedSince: null,
      eventsReceived: r.events,
      duplicatesDropped: 0,
      openSubscriptions: r.subs,
      bytesIn: 0,
      bytesOut: 0,
      lastError: r.error ?? null,
      latencyMs: r.latencyMs ?? null,
    })),
    totals: {
      eventsStored: core.world.notes.length,
      cacheBytes: 0,
      subscriptions: core.subs.size,
      servedFromCache: 0,
      servedFromNetwork: 0,
    },
    orchestration: { relaysCoveringFollowSet: 0, requestsCoalesced: 0 },
  };
}
