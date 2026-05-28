import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRelayDiagnosticSummariesForTests,
  listRelayDiagnosticSummaries,
  recordRelayDiagnosticSummary,
  relayDiagnosticSummaryMemorySizeForTests,
} from '../../../src/lib/relays/relay-diagnostic-summary';
import type { RelaySnapshot } from '../../../src/lib/relays/types';

describe('relay diagnostic summaries', () => {
  beforeEach(() => clearRelayDiagnosticSummariesForTests());

  it('persists counters, timing, validation, and bounded diagnostics', async () => {
    await recordRelayDiagnosticSummary(snapshot(), {
      attempted: true,
      opened: true,
    });
    await recordRelayDiagnosticSummary(
      {
        ...snapshot(),
        lastEventId: 'e'.repeat(64),
        validation: {
          validEventCount: 2,
          invalidEventCount: 1,
          invalidSubscriptionCount: 1,
        },
        diagnostics: Array.from({ length: 25 }, (_, index) => ({
          relay: 'wss://relay.example/',
          kind: 'notice' as const,
          message: `message ${index}`,
          timestamp: index,
        })),
      },
      { errored: true },
    );

    const [summary] = await listRelayDiagnosticSummaries();
    expect(summary).toMatchObject({
      relayUrl: 'wss://relay.example/',
      attemptCount: 1,
      openCount: 1,
      errorCount: 1,
      lastEventId: 'e'.repeat(64),
      firstMessageLatencyMs: 20,
      eoseLatencyMs: 50,
      validEventCount: 2,
      invalidEventCount: 1,
      invalidSubscriptionCount: 1,
    });
    expect(summary?.recentDiagnostics).toHaveLength(20);
    expect(summary?.recentDiagnostics[0]?.message).toBe('message 5');
  });

  it('bounds in-memory diagnostic summaries', async () => {
    for (let index = 0; index < 251; index += 1) {
      await recordRelayDiagnosticSummary({
        ...snapshot(),
        url: `wss://relay-${index}.example/`,
      });
    }

    expect(relayDiagnosticSummaryMemorySizeForTests()).toBe(250);
  });
});

function snapshot(): RelaySnapshot {
  return {
    url: 'wss://relay.example/',
    state: 'open',
    connectionAttemptAt: 100,
    openedAt: 110,
    lastMessageAt: 120,
    lastEventAt: 130,
    firstMessageLatencyMs: 20,
    eoseLatencyMs: 50,
    validation: {
      validEventCount: 1,
      invalidEventCount: 0,
      invalidSubscriptionCount: 0,
    },
    stats: {
      receivedBytes: 0,
      sentBytes: 0,
      eventCount: 0,
      eoseCount: 0,
      noticeCount: 0,
      authCount: 0,
      closedCount: 0,
      okAcceptedCount: 0,
      okRejectedCount: 0,
      parseErrorCount: 0,
      activeSubscriptionIds: [],
      activeSubscriptionDescriptors: [],
    },
    diagnostics: [],
    eoseBySub: {},
    closedBySub: {},
  };
}
