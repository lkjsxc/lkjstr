import { appendAppLog } from '../log/app-log';
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
): void {
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
