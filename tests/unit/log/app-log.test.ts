import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendAppLog,
  appLogRecords,
  clearAppLogForTests,
} from '../../../src/lib/log/app-log';

describe('app log', () => {
  beforeEach(() => clearAppLogForTests());

  it('orders retained records and redacts sensitive context', () => {
    appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: 'boom',
      message: 'failed',
      context: { nsec: 'secret', relay: 'wss://relay.example' },
    });
    expect(appLogRecords()).toHaveLength(1);
    expect(appLogRecords()[0]?.context).toMatchObject({
      nsec: '[redacted]',
      relay: 'wss://relay.example',
    });
  });

  it('suppresses the external SES null noise case only', () => {
    appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: 'SES_UNCAUGHT_EXCEPTION',
      message: 'null',
      context: { filename: 'chrome-extension://x/lockdown-install.js' },
    });
    appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: 'SES_UNCAUGHT_EXCEPTION',
      message: 'real',
    });
    expect(appLogRecords()).toHaveLength(1);
  });

  it('suppresses only the known ResizeObserver browser noise', () => {
    appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: 'window-error',
      message: 'ResizeObserver loop completed with undelivered notifications.',
    });
    appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: 'window-error',
      message: 'ResizeObserver broke real layout work.',
    });
    expect(appLogRecords()).toHaveLength(1);
    expect(appLogRecords()[0]?.message).toBe(
      'ResizeObserver broke real layout work.',
    );
  });
});
