// Additive engine stats mirror for the in-memory test double.
import type { EngineStats } from '../protocol.ts';
import type { Core } from './engine.ts';
import { relays } from './relays.ts';

/** A made-up but steady share of what a relay sent that another had sent before. */
const dup = (events: number, i: number): number => Math.round((events * (18 + i * 9)) / 100);
export function mockStats(core: Core): EngineStats {
  const rows = relays(core.world);
  return {
    relays: rows.map((r, i) => ({
      url: r.url,
      state: r.state,
      route:
        r.read && r.write
          ? 'both'
          : r.read
            ? 'reading'
            : r.write
              ? 'writing'
              : r.why === 'search'
                ? 'search'
                : r.inUse
                  ? 'reading'
                  : 'unused',
      readRule: r.read ? 'reader' : r.why === 'search' ? 'search' : r.inUse ? 'hint' : 'unused',
      connectedSince: r.state === 'connected' ? core.world.base - (7 + i * 13) * 60_000 : null,
      eventsReceived: r.events,
      duplicatesDropped: dup(r.events, i),
      openSubscriptions: r.subs,
      bytesIn: r.events * (640 + i * 35),
      bytesOut: r.state === 'connected' ? 900 + r.subs * 410 : 0,
      lastError: r.error ?? null,
      latencyMs: r.latencyMs ?? null,
    })),
    // Mock wire diagnostics derive from the test double's actual open subscriptions.
    requests: [...core.subs.values()].slice(0, 256).map((sub) => ({
      id: sub.id,
      wireId: sub.id,
      relay: rows[0]!.url,
      purpose: sub.query.source === 'notifications' ? 'notifications' : 'visible',
      priority: 1,
      weight: 600,
      received: sub.end - sub.start,
      sent: true,
      complete: true,
      members: 1,
    })),
    totals: {
      eventsStored: core.world.notes.length,
      cacheBytes: core.world.notes.reduce((n, x) => n + 420 + x.text.length * 3, 0),
      subscriptions: rows.reduce((n, r) => n + r.subs, 0),
      servedFromCache: [...core.subs.values()].reduce(
        (n, s) => n + Math.min(800, s.entries.length),
        0,
      ),
      servedFromNetwork: rows.reduce((n, r, i) => n + r.events - dup(r.events, i), 0),
    },
    orchestration: {
      relaysCoveringFollowSet: rows.filter((r) => r.state === 'connected' && r.inUse).length,
      requestsCoalesced: Math.max(0, core.subs.size * 2 - 1),
    },
  };
}
