import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createZapInvoices } from '../../../src/lib/events/zap';
import {
  groupZapReceipts,
  zapReceiptAmountMsats,
} from '../../../src/lib/events/zap-summary';
import {
  splitZapAmounts,
  zapTargets,
} from '../../../src/lib/events/zap-targets';
import type { ProfileSummary } from '../../../src/lib/identity/identity';
import type { NostrEvent } from '../../../src/lib/protocol';

vi.mock('../../../src/lib/accounts/account-store', () => ({
  activeAccount: vi.fn(async () => ({
    pubkey: 'a'.repeat(64),
    signerType: 'nip07',
  })),
}));

vi.mock('../../../src/lib/accounts/nip07', () => ({
  getNip07Provider: () => ({
    signEvent: vi.fn(async (event) => ({
      ...event,
      id: 'b'.repeat(64),
      sig: 'c'.repeat(128),
    })),
  }),
}));

vi.mock('../../../src/lib/timeline/timeline-subscription', () => ({
  enabledWriteRelays: () => ['wss://receipt.example'],
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async (payload: string) => `qr:${payload}`) },
}));

describe('zaps', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            allowsNostr: true,
            callback: 'https://pay.example/callback',
            minSendable: 1,
            maxSendable: 1_000_000,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pr: 'lnbc1invoice' }),
        }),
    );
  });

  it('calculates weighted zap targets and split amounts', () => {
    const targets = zapTargets({
      ...event(),
      tags: [
        ['zap', '1'.repeat(64), 'wss://one', '1'],
        ['zap', '2'.repeat(64), 'wss://two', '3'],
        ['zap', '3'.repeat(64), 'wss://three'],
      ],
    });
    expect(targets.map((target) => target.pubkey)).toEqual([
      '1'.repeat(64),
      '2'.repeat(64),
    ]);
    expect(splitZapAmounts(1000, targets)).toEqual([250, 750]);
  });

  it('requests invoices with NIP-57 params and QR payloads', async () => {
    const invoices = await createZapInvoices({
      event: event(),
      profile: profile(),
      relaySets: [],
      amountSats: 21,
      message: 'thanks',
    });
    expect(invoices[0]?.invoice).toBe('lnbc1invoice');
    expect(invoices[0]?.qrDataUrl).toBe('qr:lnbc1invoice');
    const callback = new URL(
      (fetch as unknown as { mock: { calls: [string][] } }).mock.calls[1]![0],
    );
    expect(callback.searchParams.get('amount')).toBe('21000');
    expect(callback.searchParams.get('lnurl')).toMatch(/^lnurl/);
    expect(callback.searchParams.get('nostr')).toContain('"kind":9734');
    expect(callback.searchParams.get('nostr')).toContain(
      'wss://receipt.example',
    );
  });

  it('parses zap receipt amount tags and description requests', () => {
    expect(zapReceiptAmountMsats(zapReceipt([['amount', '21000']]))).toBe(
      21000,
    );
    expect(
      zapReceiptAmountMsats(
        zapReceipt([
          [
            'description',
            JSON.stringify({ tags: [['amount', '42000']] }),
          ],
        ]),
      ),
    ).toBe(42000);
  });

  it('groups zap receipts by target event', () => {
    const grouped = groupZapReceipts([
      zapReceipt([
        ['e', 'e'.repeat(64)],
        ['amount', '1000'],
      ]),
      zapReceipt([
        ['e', 'e'.repeat(64)],
        ['amount', '2000'],
      ]),
    ]);
    expect(grouped['e'.repeat(64)]?.amountMsats).toBe(3000);
  });
});

function event(): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: 'f'.repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: '',
    sig: 'a'.repeat(128),
  };
}

function profile(): ProfileSummary {
  return {
    pubkey: 'f'.repeat(64),
    displayName: null,
    name: null,
    nip05: null,
    avatarUrl: null,
    lud16: 'zap@example.com',
    updatedAt: 1,
  };
}

function zapReceipt(tags: string[][]): NostrEvent {
  return {
    ...event(),
    id: crypto.randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64),
    kind: 9735,
    tags,
  };
}
