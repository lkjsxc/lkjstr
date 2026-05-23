import type { RelaySnapshot, RelayValidationStats } from './types';

export class RelayClientMetrics {
  connectionAttemptAt?: number;
  openedAt?: number;
  lastMessageAt?: number;
  lastEventAt?: number;
  lastEventId?: string;
  firstMessageLatencyMs?: number;
  eoseLatencyMs?: number;
  validation: RelayValidationStats = {
    validEventCount: 0,
    invalidEventCount: 0,
    invalidSubscriptionCount: 0,
  };

  startConnect(now = Date.now()): void {
    this.connectionAttemptAt = now;
    this.openedAt = undefined;
    this.firstMessageLatencyMs = undefined;
    this.eoseLatencyMs = undefined;
  }

  open(now = Date.now()): void {
    this.openedAt = now;
  }

  receiveMessage(now = Date.now()): void {
    this.lastMessageAt = now;
    if (this.firstMessageLatencyMs === undefined && this.connectionAttemptAt) {
      this.firstMessageLatencyMs = now - this.connectionAttemptAt;
    }
  }

  acceptEvent(id: string, now = Date.now()): void {
    this.validation = {
      ...this.validation,
      validEventCount: this.validation.validEventCount + 1,
    };
    this.lastEventAt = now;
    this.lastEventId = id;
  }

  rejectEvent(): void {
    this.validation = {
      ...this.validation,
      invalidEventCount: this.validation.invalidEventCount + 1,
    };
  }

  rejectSubscription(): void {
    this.validation = {
      ...this.validation,
      invalidSubscriptionCount: this.validation.invalidSubscriptionCount + 1,
    };
  }

  eose(now = Date.now()): void {
    if (this.eoseLatencyMs === undefined && this.connectionAttemptAt)
      this.eoseLatencyMs = now - this.connectionAttemptAt;
  }

  snapshotFields(): Pick<
    RelaySnapshot,
    | 'connectionAttemptAt'
    | 'openedAt'
    | 'lastMessageAt'
    | 'lastEventAt'
    | 'lastEventId'
    | 'firstMessageLatencyMs'
    | 'eoseLatencyMs'
    | 'validation'
  > {
    return {
      connectionAttemptAt: this.connectionAttemptAt,
      openedAt: this.openedAt,
      lastMessageAt: this.lastMessageAt,
      lastEventAt: this.lastEventAt,
      lastEventId: this.lastEventId,
      firstMessageLatencyMs: this.firstMessageLatencyMs,
      eoseLatencyMs: this.eoseLatencyMs,
      validation: this.validation,
    };
  }
}
