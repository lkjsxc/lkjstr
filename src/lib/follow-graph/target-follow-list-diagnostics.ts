import type { ReadPageRelayStatus } from '$lib/relays/read-page-status';

export function failedRelaysFromStatuses(
  statuses: readonly ReadPageRelayStatus[],
): string[] {
  return dedupe(
    statuses
      .filter(
        (s) =>
          !s.eose &&
          (s.timeout || s.socketError || s.auth || s.socketClosed || s.closed),
      )
      .map((s) => s.relay),
  );
}

export function hasRelayFailure(
  statuses: readonly ReadPageRelayStatus[],
): boolean {
  return failedRelaysFromStatuses(statuses).length > 0;
}

export function hasRelayEose(statuses: readonly ReadPageRelayStatus[]): boolean {
  return statuses.some((status) => status.eose);
}

export function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
