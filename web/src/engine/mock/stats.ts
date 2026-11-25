// Additive engine stats mirror for the in-memory test double.
import type { EngineStats } from '../protocol.ts';
import type { Core } from './engine.ts';
import { relays } from './relays.ts';
import { sampleTelemetry, statsRelay } from './telemetry.ts';

/** A made-up but steady share of what a relay sent that another had sent before. */
const dup = (events: number, i: number): number => Math.round((events * (18 + i * 9)) / 100);
export function mockStats(core: Core, focused?: string): EngineStats {
  const rows = relays(core.world);
  const telemetry = sampleTelemetry(core, focused);
  return {
    ...telemetry,
    relays: rows.map((r, i) => ({
      ...statsRelay(r.url),
      cooldownRemainingMs: Math.max(0, (r.retryAt ?? 0) - core.now()),
      relayIndex: i,
      eoseMs: r.latencyMs === undefined ? null : r.latencyMs + 75,
      usefulShare: r.events ? (r.events - dup(r.events, i)) / r.events : null,
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
    requests: [...core.subs.values()]
      .filter((sub) => telemetry.views.some((view) => view.subId === sub.statsId))
      .slice(0, 256)
      .map((sub) => ({
        id: sub.statsId,
        wireId: sub.statsId,
        relay: statsRelay(rows[0]!.url).isPrivateHost
          ? 'private-relay'
          : statsRelay(rows[0]!.url).url,
        memberSubs: [sub.statsId],
        role: 'primary',
        createdAtMs: telemetry.nowMs - 300,
        firstEventAtMs: telemetry.nowMs - 120,
        hedgeDueAtMs: null,
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
