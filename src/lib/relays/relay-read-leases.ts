import { compactRelaySubscriptionId } from './subscription-id';

export type RelayReadLeaseState = {
  readSeq: number;
  activeRelaySubIds: Set<string>;
};

export function leaseRelayReadSubId(
  state: RelayReadLeaseState,
  baseSubId: string,
  requestKey: string,
): string {
  let candidate = baseSubId;
  while (state.activeRelaySubIds.has(candidate)) {
    state.readSeq += 1;
    candidate = compactRelaySubscriptionId(
      'read',
      'sub',
      `${requestKey}:${state.readSeq}`,
    );
  }
  state.activeRelaySubIds.add(candidate);
  return candidate;
}

export function releaseRelayReadSubId(
  state: RelayReadLeaseState,
  subId: string,
): void {
  state.activeRelaySubIds.delete(subId);
}
