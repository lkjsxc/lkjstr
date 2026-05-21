import type { RelayMessage } from '../protocol';
import type { RelaySessionStats } from './types';

export class RelaySessionStatsCounter {
  activeSubscriptionIds = new Set<string>();
  receivedBytes = 0;
  sentBytes = 0;
  eventCount = 0;
  eoseCount = 0;
  noticeCount = 0;
  authCount = 0;
  closedCount = 0;
  okAcceptedCount = 0;
  okRejectedCount = 0;
  parseErrorCount = 0;

  snapshot(): RelaySessionStats {
    return {
      receivedBytes: this.receivedBytes,
      sentBytes: this.sentBytes,
      eventCount: this.eventCount,
      eoseCount: this.eoseCount,
      noticeCount: this.noticeCount,
      authCount: this.authCount,
      closedCount: this.closedCount,
      okAcceptedCount: this.okAcceptedCount,
      okRejectedCount: this.okRejectedCount,
      parseErrorCount: this.parseErrorCount,
      activeSubscriptionIds: [...this.activeSubscriptionIds].sort(),
    };
  }

  receive(message: RelayMessage): void {
    if (message[0] === 'EVENT') this.eventCount++;
    if (message[0] === 'CLOSED') this.closedCount++;
    if (message[0] === 'NOTICE') this.noticeCount++;
    if (message[0] === 'AUTH') this.authCount++;
    if (message[0] === 'EOSE') this.eoseCount++;
    if (message[0] === 'OK' && message[2]) this.okAcceptedCount++;
    if (message[0] === 'OK' && !message[2]) this.okRejectedCount++;
  }
}
