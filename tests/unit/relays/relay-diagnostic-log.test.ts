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

  it('logs unrecognized relay filter item diagnostics with compact context', () => {
    logRelayDiagnostic(
      'closed',
      'unrecognised filter item: depth',
      'wss://relay.example/',
      'sub',
      [
        {
          kinds: [1],
          authors: ['a'.repeat(64)],
          limit: 10,
        },
      ],
    );

    expect(appLogRecords()).toHaveLength(1);
    expect(appLogRecords()[0]).toMatchObject({
      area: 'relay',
      severity: 'warn',
      code: 'relay-filter-invalid',
      message: 'unrecognised filter item: depth',
      context: {
        relay: 'wss://relay.example/',
        subId: 'sub',
        invalidKey: 'depth',
        message: 'unrecognised filter item: depth',
        filterCount: 1,
        filterKeys: ['kinds', 'authors', 'limit'],
      },
    });
    expect(appLogRecords()[0]?.context).not.toHaveProperty('filters');
    expect(appLogRecords()[0]?.context).not.toHaveProperty('authors');
  });
});
