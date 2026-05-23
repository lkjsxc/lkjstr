import {
  firstTagValue,
  kinds,
  tagValues,
  type NostrEvent,
} from '$lib/protocol';

export type ZapGroup = {
  readonly targetEventId: string;
  readonly amountMsats: number;
  readonly actors: readonly string[];
};

export type ZapSummaryMap = Record<string, ZapGroup>;

export function zapReceiptAmountMsats(event: NostrEvent): number | undefined {
  const tagged = numericTag(event, 'amount');
  if (tagged !== undefined) return tagged;
  const description = firstTagValue(event, 'description');
  if (!description) return undefined;
  try {
    const request = JSON.parse(description) as Partial<NostrEvent>;
    return numericTag(request, 'amount');
  } catch {
    return undefined;
  }
}

export function zapTargetEventId(event: NostrEvent): string | undefined {
  return tagValues(event, 'e').at(-1);
}

export function groupZapReceipts(
  events: readonly NostrEvent[],
): ZapSummaryMap {
  const groups = new Map<string, { amount: number; actors: Set<string> }>();
  for (const event of events) {
    if (event.kind !== kinds.zapReceipt) continue;
    const target = zapTargetEventId(event);
    const amount = zapReceiptAmountMsats(event);
    if (!target || amount === undefined) continue;
    const group = groups.get(target) ?? { amount: 0, actors: new Set() };
    group.amount += amount;
    group.actors.add(event.pubkey);
    groups.set(target, group);
  }
  return Object.fromEntries(
    [...groups].map(([targetEventId, group]) => [
      targetEventId,
      {
        targetEventId,
        amountMsats: group.amount,
        actors: [...group.actors].sort(),
      },
    ]),
  );
}

function numericTag(
  event: Partial<Pick<NostrEvent, 'tags'>>,
  tagName: string,
): number | undefined {
  const value = event.tags?.find((tag) => tag[0] === tagName)?.[1];
  if (!value || !/^\d+$/u.test(value)) return undefined;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : undefined;
}
