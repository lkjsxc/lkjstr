import type { NostrEvent, RelayMessage } from '../protocol';
import type { RelayRequestPurpose } from './relay-request-compat';

export type RelayDiagnosticKind =
  | 'closed'
  | 'notice'
  | 'auth'
  | 'timeout'
  | 'parse-error'
  | 'invalid-event'
  | 'invalid-subscription'
  | 'filter-mismatch'
  | 'request-too-large'
  | 'request-queue-drop'
  | 'send-queue-full';

export type RelayDiagnostic = {
  readonly relay: string;
  readonly subId?: string;
  readonly kind: RelayDiagnosticKind;
  readonly message: string;
  readonly timestamp: number;
};

export type RelayConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error';

export type RelaySnapshot = {
  readonly url: string;
  readonly state: RelayConnectionState;
  readonly connectionAttemptAt?: number;
  readonly openedAt?: number;
  readonly lastMessageAt?: number;
  readonly lastEventAt?: number;
  readonly lastEventId?: string;
  readonly lastError?: string;
  readonly firstMessageLatencyMs?: number;
  readonly eoseLatencyMs?: number;
  readonly validation: RelayValidationStats;
  readonly stats?: RelaySessionStats;
  readonly diagnostics: readonly RelayDiagnostic[];
  readonly eoseBySub: Readonly<Record<string, boolean>>;
  readonly closedBySub: Readonly<Record<string, string>>;
};

export type RelayValidationStats = {
  readonly validEventCount: number;
  readonly invalidEventCount: number;
  readonly invalidSubscriptionCount: number;
};

export type RelaySubscriptionDescriptor = {
  readonly id: string;
  readonly label: string;
  readonly surface?: string;
  readonly phase?: string;
  readonly purpose?: RelayRequestPurpose;
};

export type RelaySubscriptionDescriptorInput = Omit<
  RelaySubscriptionDescriptor,
  'id'
>;

export type RelaySessionStats = {
  readonly receivedBytes: number;
  readonly sentBytes: number;
  readonly eventCount: number;
  readonly eoseCount: number;
  readonly noticeCount: number;
  readonly authCount: number;
  readonly closedCount: number;
  readonly okAcceptedCount: number;
  readonly okRejectedCount: number;
  readonly parseErrorCount: number;
  readonly activeSubscriptionIds: readonly string[];
  readonly activeSubscriptionDescriptors: readonly RelaySubscriptionDescriptor[];
};

export type RelayClientEvents = {
  readonly event: (relay: string, subId: string, event: NostrEvent) => void;
  readonly message: (relay: string, message: RelayMessage) => void;
  readonly state: (snapshot: RelaySnapshot) => void;
};
