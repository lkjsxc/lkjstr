export type CoverageInterval = {
  readonly since: number;
  readonly until: number;
};

export type CoverageGap = {
  readonly since: number;
  readonly until: number;
};

export type IntervalCoverageDecision =
  | { readonly kind: 'covered' }
  | { readonly kind: 'missing'; readonly gaps: readonly CoverageGap[] };

export function normalizeCoverageIntervals(
  intervals: readonly CoverageInterval[],
): CoverageInterval[] {
  const sorted = intervals
    .filter((interval) => interval.since < interval.until)
    .toSorted((a, b) => a.since - b.since || a.until - b.until);
  const normalized: CoverageInterval[] = [];
  for (const interval of sorted) {
    const previous = normalized.at(-1);
    if (!previous || interval.since > previous.until) {
      normalized.push({ since: interval.since, until: interval.until });
      continue;
    }
    if (interval.until > previous.until)
      normalized[normalized.length - 1] = {
        since: previous.since,
        until: interval.until,
      };
  }
  return normalized;
}

export function intervalUnionCovers(
  target: CoverageInterval,
  intervals: readonly CoverageInterval[],
): IntervalCoverageDecision {
  if (target.since >= target.until)
    return { kind: 'missing', gaps: [{ ...target }] };
  const normalized = normalizeCoverageIntervals(intervals);
  const gaps: CoverageGap[] = [];
  let cursor = target.since;
  for (const interval of normalized) {
    if (interval.until <= cursor) continue;
    if (interval.since >= target.until) break;
    if (interval.since > cursor)
      gaps.push({ since: cursor, until: Math.min(interval.since, target.until) });
    cursor = Math.max(cursor, Math.min(interval.until, target.until));
    if (cursor >= target.until) break;
  }
  if (cursor < target.until) gaps.push({ since: cursor, until: target.until });
  return gaps.length === 0 ? { kind: 'covered' } : { kind: 'missing', gaps };
}
