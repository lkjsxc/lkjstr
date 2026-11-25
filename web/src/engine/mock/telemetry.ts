// Deterministic activity for the mock Stats response.
import type {
  BandwidthBucket,
  OrchestrationEvent,
  OrchestrationView,
  OrchestrationWorker,
} from '../protocol.ts';
import type { Core } from './engine.ts';

export function statsRelay(raw: string): { url: string; isPrivateHost: boolean } {
  try {
    const url = new URL(raw);
    url.username = url.password = url.search = url.hash = '';
    const host = url.hostname.replace(/\.$/, '');
    const isPrivateHost =
      /(^|\.)localhost$|\.(local|onion)$/.test(host) ||
      /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host) ||
      /^\[(::1\]|f[cd]|fe[89ab])/.test(host);
    return { url: url.href, isPrivateHost };
  } catch {
    return { url: 'private-relay', isPrivateHost: true };
  }
}

function bucket(atMs: number): BandwidthBucket {
  const wave = Math.floor(atMs / 1000) % 19;
  const eventsIn = wave < 3 ? 0 : (wave * 7) % 23;
  const duplicates = Math.floor(eventsIn / 4);
  const reqsSent = wave % 5 === 1 ? 2 : 0;
  return {
    atMs,
    eventsIn,
    duplicates,
    verified: eventsIn - duplicates,
    bytesIn: eventsIn * 683 + (wave % 3) * 21,
    bytesOut: reqsSent * 274,
    reqsSent,
  };
}

export function sampleTelemetry(core: Core, focused?: string) {
  const now = core.now();
  const second = Math.floor(now / 1000);
  const first = Math.max(0, second - 59);
  const bandwidthHistory = Array.from({ length: second - first + 1 }, (_, i) =>
    bucket((first + i) * 1000),
  );
  const cycle = Math.max(0, second - 54) * 1000;
  const orchestrationEvents: OrchestrationEvent[] = [
    {
      atMs: cycle,
      kind: 'hedge',
      relay: 'wss://relay.example',
      summary: 'Added a parallel read route after a slow start',
    },
    {
      atMs: cycle + 8000,
      kind: 'coalesce',
      relay: 'wss://relay.example',
      summary: 'Shared a relay request across logical reads',
    },
    {
      atMs: cycle + 16_000,
      kind: 'cooldown',
      relay: 'private-relay',
      summary: 'Paused relay requests after a rate limit',
    },
    {
      atMs: cycle + 23_000,
      kind: 'fallback',
      relay: 'wss://relay-2.example',
      summary: 'Used an alternate relay route',
    },
    {
      atMs: cycle + 35_000,
      kind: 'evict',
      relay: 'wss://relay.example',
      summary: 'Reclaimed a relay request slot',
    },
    {
      atMs: cycle + 48_000,
      kind: 'publish_ok',
      relay: 'wss://relay.example',
      summary: 'Relay accepted a publication',
    },
  ];
  const worker: OrchestrationWorker = {
    verifiedTotal: 2410 + core.world.notes.length,
    rejectedTotal: 8,
    droppedTotal: 0,
    verifyQueueLen: second % 7,
    verifyIngressBytes: (second % 7) * 735,
    verifyIngressCapBytes: 32 * 1024 * 1024,
    persistenceQueueLen: second % 13,
    lastTickMs: 1.8 + (second % 5) * 0.7,
    maxTickMs: 15.2,
    sliceLimit: 32,
    regularStored: core.world.notes.length,
    replaceableStored: 0,
    memoryCapBytes: 64 * 1024 * 1024,
  };
  const views = [...core.subs.values()]
    .filter(
      ({ query }) =>
        !['bookmarks', 'list', 'mutes', 'media-servers', 'diagnostics', 'relays'].includes(
          query.source,
        ) &&
        !query.privateLists &&
        (query.source !== 'relay' || !statsRelay(query.relay ?? '').isPrivateHost),
    )
    .slice(0, 128)
    .map((sub): OrchestrationView => {
      const anchorAtMs = sub.timeRange?.at ?? sub.monthAnchor;
      return {
        subId: sub.statsId,
        source: sub.query.source,
        visible: sub.visible,
        focused: sub.visible && sub.id === focused,
        rowCount: sub.windowed ? sub.end - sub.start : Math.min(51, sub.entries.length),
        windowKind: sub.timeRange
          ? 'at'
          : sub.monthAnchor !== undefined
            ? 'month'
            : sub.anchor
              ? 'key'
              : 'top',
        ...(anchorAtMs !== undefined && { anchorAtMs }),
        ...(sub.timeRange && { newerCoverage: 'cache-only', olderCoverage: 'cache-only' }),
        freshCount: sub.fresh,
      };
    });
  return {
    views,
    worker,
    bandwidthHistory,
    orchestrationEvents: orchestrationEvents.filter((event) => event.atMs <= now),
  };
}
