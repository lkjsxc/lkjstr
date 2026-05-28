import type { NostrFilter } from '../protocol';
import type { RelayRouteGroup } from '../relays/relay-route-types';
import { coverageForFeed } from './feed-coverage-store';
import { semanticFilterKey } from './relay-page-scan-diagnostics';
import type { FeedCoverage } from './types';

export type CoverageRequirement = {
  readonly groupKey: string;
  readonly relayUrl: string;
  readonly filterKey: string;
  readonly since?: number;
  readonly until?: number;
};

export type CoverageDecision =
  | { readonly kind: 'covered' }
  | { readonly kind: 'missing'; readonly reason: string };

export function coverageRequirements(input: {
  readonly groups: readonly RelayRouteGroup[];
  readonly filters: (
    group: RelayRouteGroup,
  ) => readonly Pick<NostrFilter, 'ids' | 'authors' | 'kinds' | 'search'>[];
  readonly since?: number;
  readonly until?: number;
}): CoverageRequirement[] {
  return input.groups.flatMap((group) =>
    group.relays.flatMap((relayUrl) =>
      input.filters(group).map((filter) => ({
        groupKey: group.key,
        relayUrl,
        filterKey: semanticFilterKey(filter),
        since: input.since,
        until: input.until,
      })),
    ),
  );
}

export function coverageRequirementKeys(
  requirements: readonly CoverageRequirement[],
): readonly string[] {
  return requirements.map(requirementKey);
}

export function completeCoverageKeys(
  coverage: readonly FeedCoverage[],
): ReadonlySet<string> {
  return new Set(
    coverage
      .filter((row) => row.status === 'complete')
      .map((row) =>
        requirementKey({
          groupKey: row.groupKey,
          relayUrl: row.relayUrl,
          filterKey: row.filterKey,
          since: row.since,
          until: row.until,
        }),
      ),
  );
}

export function coverageCoversRequirements(
  requirements: readonly CoverageRequirement[],
  coverage: readonly FeedCoverage[],
): CoverageDecision {
  const required = coverageRequirementKeys(requirements);
  if (required.length === 0)
    return { kind: 'missing', reason: 'no coverage requirements' };
  const complete = completeCoverageKeys(coverage);
  const missing = required.find((key) => !complete.has(key));
  return missing
    ? { kind: 'missing', reason: `missing complete coverage: ${missing}` }
    : { kind: 'covered' };
}

export async function segmentCoverageDecision(input: {
  readonly feedKey: string;
  readonly requirements: readonly CoverageRequirement[];
}): Promise<CoverageDecision> {
  return coverageCoversRequirements(
    input.requirements,
    await coverageForFeed(input.feedKey),
  );
}

function requirementKey(requirement: CoverageRequirement): string {
  return [
    requirement.groupKey,
    requirement.relayUrl,
    requirement.filterKey,
    requirement.since ?? '',
    requirement.until ?? '',
  ].join('|');
}
