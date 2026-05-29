import type { NostrFilter } from '../protocol';
import type { RelayRouteGroup } from '../relays/relay-route-types';
import { coverageForFeed } from './feed-coverage-store';
import { intervalUnionCovers } from './feed-coverage-intervals';
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
  | {
      readonly kind: 'missing';
      readonly reason: string;
      readonly missing: readonly CoverageMissingRequirement[];
    };

export type CoverageMissingRequirement = CoverageRequirement & {
  readonly reason: string;
  readonly gaps?: readonly { readonly since: number; readonly until: number }[];
};

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
  if (requirements.length === 0)
    return missingDecision([
      {
        groupKey: '',
        relayUrl: '',
        filterKey: '',
        reason: 'no coverage requirements',
      },
    ]);
  const complete = completeCoverageByIdentity(coverage);
  const missing = requirements.flatMap((requirement) => {
    if (requirement.since === undefined)
      return [{ ...requirement, reason: 'missing since bound' }];
    if (requirement.until === undefined)
      return [{ ...requirement, reason: 'missing until bound' }];
    const intervals = complete.get(identityKey(requirement)) ?? [];
    const decision = intervalUnionCovers(
      { since: requirement.since, until: requirement.until },
      intervals,
    );
    return decision.kind === 'covered'
      ? []
      : [
          {
            ...requirement,
            reason: 'missing complete coverage interval',
            gaps: decision.gaps,
          },
        ];
  });
  return missing.length === 0 ? { kind: 'covered' } : missingDecision(missing);
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

function identityKey(
  requirement: Pick<CoverageRequirement, 'groupKey' | 'relayUrl' | 'filterKey'>,
): string {
  return [requirement.groupKey, requirement.relayUrl, requirement.filterKey].join(
    '|',
  );
}

function completeCoverageByIdentity(
  coverage: readonly FeedCoverage[],
): ReadonlyMap<string, readonly { readonly since: number; readonly until: number }[]> {
  const byIdentity = new Map<
    string,
    { readonly since: number; readonly until: number }[]
  >();
  for (const row of coverage) {
    if (
      row.status !== 'complete' ||
      row.since === undefined ||
      row.until === undefined
    )
      continue;
    const key = identityKey(row);
    byIdentity.set(key, [
      ...(byIdentity.get(key) ?? []),
      { since: row.since, until: row.until },
    ]);
  }
  return byIdentity;
}

function missingDecision(
  missing: readonly CoverageMissingRequirement[],
): Extract<CoverageDecision, { readonly kind: 'missing' }> {
  const first = missing[0];
  const identity = first
    ? [first.groupKey, first.relayUrl, first.filterKey].filter(Boolean).join('|')
    : '';
  return {
    kind: 'missing',
    reason: identity
      ? `${first?.reason ?? 'missing complete coverage'}: ${identity}`
      : 'missing complete coverage',
    missing,
  };
}
