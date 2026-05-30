import type { NostrFilter } from '../../protocol';
import type { RelayInformationDocument } from '../relay-info';

export type RequestBudgetSurface =
  | 'home'
  | 'global'
  | 'notifications'
  | 'profile'
  | 'thread'
  | 'search'
  | 'custom-request'
  | 'author-context';

export type RequestBudgetPurpose =
  | 'feed'
  | 'metadata'
  | 'event-lookup'
  | 'route-discovery'
  | 'search';

export type RequestBudgetInput = {
  readonly surface: RequestBudgetSurface;
  readonly phase: 'bootstrap' | 'page' | 'live';
  readonly direction?: 'initial' | 'older' | 'newer';
  readonly purpose?: RequestBudgetPurpose;
  readonly pageSize?: number;
  readonly relayUrl: string;
  readonly filterCount: number;
  readonly requestedFilterLimit?: number;
  readonly hasSearchFilter: boolean;
  readonly exactEventLookup: boolean;
  readonly relayInfo?: RelayInformationDocument;
};

export type RequestBudgetWarningKind =
  | 'app-limit-clamped'
  | 'relay-limit-clamped'
  | 'relay-default-limit'
  | 'request-too-large'
  | 'auth-required'
  | 'payment-required'
  | 'restricted-writes'
  | 'pow-required'
  | 'created-at-bound';

export type RequestBudgetWarning = {
  readonly kind: RequestBudgetWarningKind;
  readonly message: string;
  readonly value?: number | string | boolean;
};

export type RequestBudget = {
  readonly relayUrl: string;
  readonly filterLimit?: number;
  readonly maxEvents: number;
  readonly timeoutMs: number;
  readonly maxMessageLength?: number;
  readonly maxSubscriptions: number;
  readonly maxSubscriptionIdLength: number;
  readonly warnings: readonly RequestBudgetWarning[];
};

export type BudgetedFilters = {
  readonly filters: readonly NostrFilter[];
  readonly warnings: readonly RequestBudgetWarning[];
};
