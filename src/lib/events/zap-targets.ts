import type { ProfileSummary } from '../identity/identity';
import type { NostrEvent } from '../protocol';

export type ZapTarget = {
  readonly pubkey: string;
  readonly relays: readonly string[];
  readonly weight: number;
};

export function zapTargets(
  event: NostrEvent,
  profile?: ProfileSummary,
): ZapTarget[] {
  const tags = event.tags.filter((tag) => tag[0] === 'zap' && isPubkey(tag[1]));
  if (tags.length === 0)
    return [{ pubkey: profile?.pubkey ?? event.pubkey, relays: [], weight: 1 }];
  const hasWeight = tags.some((tag) => numericWeight(tag[3]) !== undefined);
  return tags
    .map((tag) => ({
      pubkey: tag[1]!,
      relays: tag[2] ? [tag[2]] : [],
      weight: numericWeight(tag[3]) ?? (hasWeight ? 0 : 1),
    }))
    .filter((target) => target.weight > 0);
}

export function splitZapAmounts(
  totalMsats: number,
  targets: readonly ZapTarget[],
): number[] {
  const weightTotal = targets.reduce((sum, target) => sum + target.weight, 0);
  if (totalMsats < 1 || weightTotal <= 0) return targets.map(() => 0);
  let assigned = 0;
  return targets.map((target, index) => {
    if (index === targets.length - 1) return totalMsats - assigned;
    const amount = Math.floor((totalMsats * target.weight) / weightTotal);
    assigned += amount;
    return amount;
  });
}

function numericWeight(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isPubkey(value: string | undefined): value is string {
  return /^[0-9a-f]{64}$/i.test(value ?? '');
}
