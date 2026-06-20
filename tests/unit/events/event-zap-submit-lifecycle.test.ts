import { describe, expect, it } from 'vitest';
import { runEventZapSubmit } from '../../../src/lib/components/events/event-zap-submit-plan';

describe('event zap submit lifecycle', () => {
  it('clears retained invoices, applies new invoices, and publishes success status', async () => {
    const harness = createZapSubmitHarness();
    const invoice = { invoice: 'lnbc1', amountMsats: 21_000 };

    await runEventZapSubmit({
      ...harness.callbacks,
      createInvoices: async () => {
        harness.calls.push('create');
        return [invoice];
      },
    });

    expect(harness.state()).toEqual({
      busy: false,
      calls: [
        'busy:true',
        'status:',
        'invoices:',
        'create',
        'invoices:lnbc1',
        'busy:false',
        'status:Invoice ready.',
      ],
      invoices: [invoice],
      status: 'Invoice ready.',
    });
  });

  it('keeps retained invoices cleared when zap invoice creation fails', async () => {
    const harness = createZapSubmitHarness();

    await runEventZapSubmit({
      ...harness.callbacks,
      createInvoices: async () => {
        throw new Error('No lud16.');
      },
    });

    expect(harness.state()).toEqual({
      busy: false,
      calls: [
        'busy:true',
        'status:',
        'invoices:',
        'busy:false',
        'status:No lud16.',
      ],
      invoices: [],
      status: 'No lud16.',
    });
  });
});

function createZapSubmitHarness() {
  let busy = false;
  let invoices: readonly TestInvoice[] = [{ invoice: 'old', amountMsats: 1 }];
  let status = 'previous';
  const calls: string[] = [];

  return {
    calls,
    callbacks: {
      setBusy: (next: boolean) => {
        busy = next;
        calls.push(`busy:${next}`);
      },
      setInvoices: (next: readonly TestInvoice[]) => {
        invoices = next;
        calls.push(`invoices:${next.map((item) => item.invoice).join(',')}`);
      },
      setStatus: (next: string) => {
        status = next;
        calls.push(`status:${next}`);
      },
    },
    state: () => ({
      busy,
      calls: [...calls],
      invoices,
      status,
    }),
  };
}

type TestInvoice = {
  readonly amountMsats: number;
  readonly invoice: string;
};
