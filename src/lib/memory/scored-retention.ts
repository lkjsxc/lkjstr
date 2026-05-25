export type RetentionSignal = {
  readonly id: string;
  readonly createdAt: number;
  readonly lastAccessedAt?: number;
  readonly referenced?: boolean;
  readonly active?: boolean;
  readonly pinned?: boolean;
};

export function scoreRetentionCandidate(candidate: RetentionSignal): number {
  return (
    candidate.createdAt +
    (candidate.lastAccessedAt ?? 0) * 0.25 +
    (candidate.referenced ? 1_000_000_000_000 : 0) +
    (candidate.active ? 2_000_000_000_000 : 0) +
    (candidate.pinned ? 3_000_000_000_000 : 0)
  );
}

export function selectRetained<T extends RetentionSignal>(
  candidates: readonly T[],
  limit: number,
): T[] {
  const cap = Math.max(0, Math.floor(limit));
  if (cap === 0) return [];
  return [...candidates]
    .sort((a, b) => {
      const score = scoreRetentionCandidate(b) - scoreRetentionCandidate(a);
      return score === 0 ? a.id.localeCompare(b.id) : score;
    })
    .slice(0, cap);
}
