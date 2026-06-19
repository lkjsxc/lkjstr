import { describe, expect, it } from 'vitest';
import {
  copyEventZapInvoiceStatus,
  copyZapInvoice,
  zapInvoiceCopyStatusText,
} from '../../../src/lib/components/events/zap-copy-status';

describe('zap invoice copy status', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copyZapInvoice('lnbc1invoice', clipboard);

    expect(clipboard.writes).toEqual(['lnbc1invoice']);
    expect(status).toEqual({ kind: 'copied' });
    expect(zapInvoiceCopyStatusText(status)).toBe('Invoice copied.');
  });

  it('reports unavailable clipboard without claiming copied status', async () => {
    const status = await copyZapInvoice('lnbc1invoice', undefined);

    expect(status).toEqual({
      kind: 'failed',
      reason: 'Clipboard unavailable',
    });
    expect(zapInvoiceCopyStatusText(status)).toBe(
      'Invoice copy failed: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming copied status', async () => {
    const status = await copyZapInvoice('lnbc1invoice', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({ kind: 'failed', reason: 'denied' });
    expect(zapInvoiceCopyStatusText(status)).toBe(
      'Invoice copy failed: denied',
    );
  });

  it('shows copied status only after the clipboard write resolves', async () => {
    const writes: string[] = [];
    const statuses: string[] = [];
    let resolveWrite: (() => void) | undefined;
    const pendingWrite = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });

    const copy = copyEventZapInvoiceStatus('lnbc1invoice', {
      clipboard: {
        writeText: async (value) => {
          writes.push(value);
          await pendingWrite;
        },
      },
      setStatus: (status) => statuses.push(status),
    });

    expect(writes).toEqual(['lnbc1invoice']);
    expect(statuses).toEqual([]);

    resolveWrite?.();
    await copy;

    expect(statuses).toEqual(['Invoice copied.']);
  });

  it('shows explicit failure status for unavailable invoice copy', async () => {
    const statuses: string[] = [];

    await copyEventZapInvoiceStatus('lnbc1invoice', {
      clipboard: undefined,
      setStatus: (status) => statuses.push(status),
    });

    expect(statuses).toEqual(['Invoice copy failed: Clipboard unavailable']);
  });
});
