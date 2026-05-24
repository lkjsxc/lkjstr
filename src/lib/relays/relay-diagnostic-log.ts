import { appendAppLog } from '../log/app-log';
import type { NostrFilter } from '../protocol';
import type { RelayDiagnosticKind } from './types';

const suppressionWindowMs = 10_000;
const suppressed = new Map<string, SuppressionState>();

type SuppressionState = {
  readonly lastVisibleAt: number;
  readonly count: number;
};

export function logRelayDiagnostic(
  kind: RelayDiagnosticKind,
  message: string,
  relay: string,
  subId?: string,
  filters: readonly NostrFilter[] = [],
): void {
  if (kind === 'notice' || kind === 'closed') {
    const invalid = invalidFilterDiagnostic(message);
    if (invalid) {
      logInvalidFilterDiagnostic(relay, message, filters, subId, invalid);
      return;
    }
  }
  const now = Date.now();
  const key = diagnosticKey(kind, message, relay, subId);
  const state = suppressed.get(key);
  if (state && now - state.lastVisibleAt < suppressionWindowMs) {
    suppressed.set(key, { ...state, count: state.count + 1 });
    return;
  }
  suppressed.set(key, { lastVisibleAt: now, count: 0 });
  appendAppLog({
    area: 'relay',
    severity: kind === 'notice' ? 'info' : 'warn',
    code: kind,
    message: state?.count ? suppressedMessage(message, state.count) : message,
    context: { relay, subId },
  });
}

export function clearRelayDiagnosticLogForTests(): void {
  suppressed.clear();
}

function diagnosticKey(
  kind: RelayDiagnosticKind,
  message: string,
  relay: string,
  subId?: string,
): string {
  return `${relay}\n${subId ?? ''}\n${kind}\n${message}`;
}

function suppressedMessage(message: string, count: number): string {
  return `${message} (${Math.min(count, 9999)} repeats suppressed)`;
}

function invalidFilterDiagnostic(
  message: string,
): { invalidKey?: string } | undefined {
  const match = message.match(
    /unrecogni[sz]ed filter item(?:\s*[:=]|\s+)?\s*["'`]?([^"',`\s\]}]+)?/i,
  );
  if (!match) return undefined;
  return { invalidKey: match[1] };
}

function logInvalidFilterDiagnostic(
  relay: string,
  message: string,
  filters: readonly NostrFilter[],
  subId: string | undefined,
  invalid: { readonly invalidKey?: string },
): void {
  const now = Date.now();
  const key = diagnosticKey(
    'closed',
    `relay-filter-invalid:${message}`,
    relay,
    subId,
  );
  const state = suppressed.get(key);
  if (state && now - state.lastVisibleAt < suppressionWindowMs) {
    suppressed.set(key, { ...state, count: state.count + 1 });
    return;
  }
  suppressed.set(key, { lastVisibleAt: now, count: 0 });
  appendAppLog({
    area: 'relay',
    severity: 'warn',
    code: 'relay-filter-invalid',
    message: state?.count ? suppressedMessage(message, state.count) : message,
    context: compactFilterContext(relay, subId, message, filters, invalid),
  });
}

function compactFilterContext(
  relay: string,
  subId: string | undefined,
  message: string,
  filters: readonly NostrFilter[],
  invalid: { readonly invalidKey?: string },
): Readonly<Record<string, unknown>> {
  return {
    relay,
    ...(subId ? { subId } : {}),
    ...(invalid.invalidKey ? { invalidKey: invalid.invalidKey } : {}),
    message,
    filterCount: filters.length,
    filterKeys: [...new Set(filters.flatMap((filter) => Object.keys(filter)))],
  };
}
