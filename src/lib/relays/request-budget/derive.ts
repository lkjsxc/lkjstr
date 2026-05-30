import {
  appFilterCap,
  appRequestBudgetCaps,
  intendedFilterLimit,
} from './policy';
import { nip11RequestConstraints } from './nip11';
import type {
  RequestBudget,
  RequestBudgetInput,
  RequestBudgetWarning,
} from './types';

export function deriveRequestBudget(input: RequestBudgetInput): RequestBudget {
  const constraints = nip11RequestConstraints(input.relayInfo);
  const intended = intendedFilterLimit(input);
  const filterCap = appFilterCap(input.purpose);
  const warnings: RequestBudgetWarning[] = [...constraints.warnings];
  const filterLimit = deriveFilterLimit({
    intended,
    appCap: filterCap,
    relayCap: constraints.maxLimit,
    relayDefault: constraints.defaultLimit,
    warnings,
    liveWithoutLimit: input.phase === 'live' && !input.requestedFilterLimit,
  });
  const maxEvents = deriveMaxEvents(input, filterLimit, intended);
  return {
    relayUrl: input.relayUrl,
    filterLimit,
    maxEvents,
    timeoutMs: appRequestBudgetCaps.timeoutMs,
    maxMessageLength: constraints.maxMessageLength,
    maxSubscriptions: constraints.maxSubscriptions,
    maxSubscriptionIdLength: constraints.maxSubscriptionIdLength,
    warnings,
  };
}

function deriveFilterLimit(input: {
  readonly intended: number;
  readonly appCap: number;
  readonly relayCap?: number;
  readonly relayDefault?: number;
  readonly liveWithoutLimit: boolean;
  readonly warnings: RequestBudgetWarning[];
}): number | undefined {
  if (input.liveWithoutLimit) return undefined;
  const appLimited = Math.min(input.intended, input.appCap);
  if (appLimited < input.intended)
    input.warnings.push(clamp('app-limit-clamped', input.appCap));
  const relayLimited = Math.min(appLimited, input.relayCap ?? appLimited);
  if (relayLimited < appLimited)
    input.warnings.push(clamp('relay-limit-clamped', relayLimited));
  if (input.relayDefault && relayLimited > input.relayDefault) {
    input.warnings.push({
      kind: 'relay-default-limit',
      message: 'explicit limit exceeds relay default',
      value: input.relayDefault,
    });
  }
  return Math.max(1, relayLimited);
}

function deriveMaxEvents(
  input: RequestBudgetInput,
  filterLimit: number | undefined,
  intended: number,
): number {
  const filters = Math.max(1, input.filterCount);
  const page = Math.max(1, input.pageSize ?? intended);
  if (input.phase === 'live') return appRequestBudgetCaps.maxEvents;
  if (input.exactEventLookup) {
    return Math.min(appRequestBudgetCaps.maxEvents, Math.max(page, intended));
  }
  const perFilter = filterLimit ?? intended;
  return Math.min(
    appRequestBudgetCaps.maxEvents,
    Math.max(page, perFilter * filters + page),
  );
}

function clamp(
  kind: 'app-limit-clamped' | 'relay-limit-clamped',
  value: number,
): RequestBudgetWarning {
  return { kind, message: 'request limit was clamped', value };
}
