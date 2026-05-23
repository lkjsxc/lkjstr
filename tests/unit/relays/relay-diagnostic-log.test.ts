import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appLogRecords,
  clearAppLogForTests,
} from '../../../src/lib/log/app-log';
import {
  clearRelayDiagnosticLogForTests,
  logRelayDiagnostic,
} from '../../../src/lib/relays/relay-diagnostic-log';

describe('relay diagnostic log', () => {
  beforeEach(() => {
    clearAppLogForTests();
    clearRelayDiagnosticLogForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05Z'));
  });

  it('throttles repeated identical app-log diagnostics', () => {
    logRelayDiagnostic('parse-error', 'bad json', 'wss://relay.example/', 'a');
    logRelayDiagnostic('parse-error', 'bad json', 'wss://relay.example/', 'a');
    logRelayDiagnostic('parse-error', 'bad json', 'wss://relay.example/', 'a');

    expect(appLogRecords()).toHaveLength(1);

    vi.advanceTimersByTime(10_000);
    logRelayDiagnostic('parse-error', 'bad json', 'wss://relay.example/', 'a');

    expect(appLogRecords()).toHaveLength(2);
    expect(appLogRecords()[1]?.message).toBe('bad json (2 repeats suppressed)');
  });
});
