import type { RelayMessage } from '../protocol';
import type { RelaySessionStats } from './types';

export type RelaySessionStatsCounter = ReturnType<
  typeof createRelaySessionStatsCounter
>;

export function createRelaySessionStatsCounter() {
  const activeSubscriptionIds = new Set<string>();
  let receivedBytes = 0;
  let sentBytes = 0;
  let eventCount = 0;
  let eoseCount = 0;
  let noticeCount = 0;
  let authCount = 0;
  let closedCount = 0;
  let okAcceptedCount = 0;
  let okRejectedCount = 0;
  let parseErrorCount = 0;

  return {
    activeSubscriptionIds,
    addReceivedBytes: (bytes: number) => (receivedBytes += bytes),
    addSentBytes: (bytes: number) => (sentBytes += bytes),
    addParseError: () => (parseErrorCount += 1),
    snapshot: (): RelaySessionStats => ({
      receivedBytes,
      sentBytes,
      eventCount,
      eoseCount,
      noticeCount,
      authCount,
      closedCount,
      okAcceptedCount,
      okRejectedCount,
      parseErrorCount,
      activeSubscriptionIds: [...activeSubscriptionIds].sort(),
    }),
    receive: (message: RelayMessage): void => {
      if (message[0] === 'EVENT') eventCount++;
      if (message[0] === 'CLOSED') closedCount++;
      if (message[0] === 'NOTICE') noticeCount++;
      if (message[0] === 'AUTH') authCount++;
      if (message[0] === 'EOSE') eoseCount++;
      if (message[0] === 'OK' && message[2]) okAcceptedCount++;
      if (message[0] === 'OK' && !message[2]) okRejectedCount++;
    },
  };
}
