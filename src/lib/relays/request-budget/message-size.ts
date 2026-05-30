import { encodeClientMessage, type NostrFilter } from '../../protocol';
import type { RequestBudget, RequestBudgetWarning } from './types';
import { appRequestBudgetCaps } from './policy';

export function estimateReqMessageBytes(
  subId: string,
  filters: readonly NostrFilter[],
): number {
  return new TextEncoder().encode(
    encodeClientMessage(['REQ', subId, ...filters]),
  ).byteLength;
}

export function requestMessageSizeWarning(
  subId: string,
  filters: readonly NostrFilter[],
  budget: RequestBudget,
): RequestBudgetWarning | undefined {
  const bytes = estimateReqMessageBytes(subId, filters);
  const cap = Math.min(
    budget.maxMessageLength ?? appRequestBudgetCaps.maxReqMessageBytes,
    appRequestBudgetCaps.maxReqMessageBytes,
  );
  if (bytes <= cap) return undefined;
  return {
    kind: 'request-too-large',
    message: 'REQ exceeds local message size cap',
    value: `${bytes}/${cap}`,
  };
}
