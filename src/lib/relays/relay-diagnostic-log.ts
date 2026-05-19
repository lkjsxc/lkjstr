import { appendAppLog } from '../log/app-log';
import type { RelayDiagnosticKind } from './types';

export function logRelayDiagnostic(
  kind: RelayDiagnosticKind,
  message: string,
  relay: string,
  subId?: string,
): void {
  appendAppLog({
    area: 'relay',
    severity: kind === 'notice' ? 'info' : 'warn',
    code: kind,
    message,
    context: { relay, subId },
  });
}
