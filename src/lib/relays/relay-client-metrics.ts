import type { RelaySnapshot, RelayValidationStats } from './types';

export type RelayClientMetrics = ReturnType<typeof createRelayClientMetrics>;

export function createRelayClientMetrics() {
  let connectionAttemptAt: number | undefined;
  let openedAt: number | undefined;
  let lastMessageAt: number | undefined;
  let lastEventAt: number | undefined;
  let lastEventId: string | undefined;
  let firstMessageLatencyMs: number | undefined;
  let eoseLatencyMs: number | undefined;
  let validation: RelayValidationStats = {
    validEventCount: 0,
    invalidEventCount: 0,
    invalidSubscriptionCount: 0,
  };

  return {
    startConnect: (now = Date.now()) => {
      connectionAttemptAt = now;
      openedAt = undefined;
      firstMessageLatencyMs = undefined;
      eoseLatencyMs = undefined;
    },
    open: (now = Date.now()) => {
      openedAt = now;
    },
    receiveMessage: (now = Date.now()) => {
      lastMessageAt = now;
      if (firstMessageLatencyMs === undefined && connectionAttemptAt)
        firstMessageLatencyMs = now - connectionAttemptAt;
    },
    acceptEvent: (id: string, now = Date.now()) => {
      validation = {
        ...validation,
        validEventCount: validation.validEventCount + 1,
      };
      lastEventAt = now;
      lastEventId = id;
    },
    rejectEvent: () => {
      validation = {
        ...validation,
        invalidEventCount: validation.invalidEventCount + 1,
      };
    },
    rejectSubscription: () => {
      validation = {
        ...validation,
        invalidSubscriptionCount: validation.invalidSubscriptionCount + 1,
      };
    },
    eose: (now = Date.now()) => {
      if (eoseLatencyMs === undefined && connectionAttemptAt)
        eoseLatencyMs = now - connectionAttemptAt;
    },
    snapshotFields: (): Pick<
      RelaySnapshot,
      | 'connectionAttemptAt'
      | 'openedAt'
      | 'lastMessageAt'
      | 'lastEventAt'
      | 'lastEventId'
      | 'firstMessageLatencyMs'
      | 'eoseLatencyMs'
      | 'validation'
    > => ({
      connectionAttemptAt,
      openedAt,
      lastMessageAt,
      lastEventAt,
      lastEventId,
      firstMessageLatencyMs,
      eoseLatencyMs,
      validation,
    }),
  };
}
