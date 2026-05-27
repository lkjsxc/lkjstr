import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendAppLog,
  appLogInputFromErrorEvent,
  appLogInputFromPromiseRejection,
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

  it('normalizes browser error captures with bounded safe context', () => {
    appendAppLog(
      appLogInputFromErrorEvent(
        errorEvent({
          message: 'boom',
          error: new TypeError('bad startup'),
          filename: 'http://localhost/app.js',
          lineno: 3,
          colno: 7,
        }),
      ),
    );
    expect(appLogRecords()[0]).toMatchObject({
      code: 'window-error',
      message: 'boom',
      context: {
        filename: 'http://localhost/app.js',
        lineno: 3,
        colno: 7,
        errorName: 'TypeError',
        errorMessage: 'bad startup',
      },
    });
  });

  it('normalizes unhandled rejection captures with error details', () => {
    appendAppLog(
      appLogInputFromPromiseRejection({
        reason: new Error('async failed'),
      } as PromiseRejectionEvent),
    );
    expect(appLogRecords()[0]).toMatchObject({
      code: 'unhandled-rejection',
      message: 'async failed',
      context: { errorName: 'Error', errorMessage: 'async failed' },
    });
  });

  it('suppresses only the external SES null noise signature', () => {
    appendAppLog(
      appLogInputFromErrorEvent(
        errorEvent({
          message: 'SES_UNCAUGHT_EXCEPTION',
          error: null,
          filename: 'chrome-extension://x/lockdown-install.js',
        }),
      ),
    );
    appendAppLog(
      appLogInputFromErrorEvent(
        errorEvent({
          message: 'SES_UNCAUGHT_EXCEPTION',
          error: null,
          filename: 'http://localhost/lockdown-install.js',
        }),
      ),
    );
    appendAppLog(
      appLogInputFromErrorEvent(
        errorEvent({
          message: 'SES_UNCAUGHT_EXCEPTION',
          error: new Error('real'),
          filename: 'chrome-extension://x/lockdown-install.js',
        }),
      ),
    );
    appendAppLog(
      appLogInputFromErrorEvent(
        errorEvent({
          message: 'null',
          error: null,
          filename: 'chrome-extension://x/not-lockdown.js',
        }),
      ),
    );
    expect(appLogRecords()).toHaveLength(3);
    expect(appLogRecords().map((record) => record.message)).toEqual([
      'null',
      'real',
      'null',
    ]);
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

function errorEvent(input: {
  readonly message: string;
  readonly error: unknown;
  readonly filename: string;
  readonly lineno?: number;
  readonly colno?: number;
}): ErrorEvent {
  return {
    message: input.message,
    error: input.error,
    filename: input.filename,
    lineno: input.lineno ?? 0,
    colno: input.colno ?? 0,
  } as ErrorEvent;
}
