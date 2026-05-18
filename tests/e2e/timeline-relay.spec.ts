import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

test('timeline does not read public relays without an active account', async ({
  page,
}) => {
  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await expect(page.getByText('no-active-account')).toBeVisible();
  await expect(page.getByText('Add or activate an account')).toBeVisible();
  await page.evaluate(() => {
    window.__syntheticSockets.length = 0;
  });
  await page.waitForTimeout(100);
  const socketCount = await page.evaluate(
    () => window.__syntheticSockets.length,
  );
  expect(socketCount).toBe(0);
});

test('timeline displays followed-author notes from a synthetic relay', async ({
  page,
}) => {
  const activeKey = generateSecretKey();
  const followedKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  const followed = getPublicKey(followedKey);
  const followList = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 3,
      tags: [['p', followed]],
      content: '',
    },
    activeKey,
  );
  const note = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'synthetic account-home note',
    },
    followedKey,
  );
  const metadata = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify({ display_name: 'Followed Writer' }),
    },
    followedKey,
  );

  await installSyntheticRelay(page, { events: [followList, note, metadata] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByText('synthetic account-home note')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Followed Writer/ }),
  ).toBeVisible();
  const npub = nip19.npubEncode(followed);
  const metaParts = await page
    .locator('.event-meta')
    .filter({ hasText: npub })
    .first()
    .locator('> *')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.trim() ?? ''),
    );
  expect(metaParts[0]).toContain('Followed Writer');
  expect(metaParts[1]).toBe(npub);
  expect(metaParts[3]).toContain(note.id.slice(0, 8));
  await expect(page.getByText('ready-with-events')).toBeVisible();
  await page.getByRole('button', { name: 'Open profile' }).first().click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('timeline shows relay closed diagnostics', async ({ page }) => {
  const activeKey = generateSecretKey();
  const active = getPublicKey(activeKey);
  await installSyntheticRelay(page, {
    events: [],
    closed: ['timeline', 'blocked: synthetic close'],
  });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, active);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByText('subscription-closed')).toBeVisible();
  await expect(
    page.getByText('closed: blocked: synthetic close').first(),
  ).toBeVisible();
});

async function addReadonlyAccount(page: Page, pubkey: string) {
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Accounts' }).click();
  page.once('dialog', (dialog) => dialog.accept(pubkey));
  await page.getByRole('button', { name: 'Add read-only' }).click();
}

async function openCleanWorkspace(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    window.__syntheticSockets.length = 0;
  });
  await page.reload();
}

async function installSyntheticRelay(
  page: Page,
  options: { events: unknown[]; closed?: [string, string] },
) {
  await page.addInitScript((relayOptions) => {
    localStorage.clear();
    class SyntheticWebSocket {
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      sent: string[] = [];
      constructor(readonly url: string) {
        window.__syntheticSockets.push(this);
        queueMicrotask(() => this.onopen?.({} as Event));
      }
      send(data: string): void {
        this.sent.push(data);
        const message = JSON.parse(data);
        if (message[0] !== 'REQ') return;
        const subId = String(message[1]);
        queueMicrotask(() => this.reply(subId, message.slice(2)));
      }
      reply(subId: string, filters: unknown[]): void {
        if (relayOptions.closed)
          this.onmessage?.({
            data: JSON.stringify(['CLOSED', subId, relayOptions.closed[1]]),
          } as MessageEvent);
        for (const event of matchingEvents(relayOptions.events, filters))
          this.onmessage?.({
            data: JSON.stringify(['EVENT', subId, event]),
          } as MessageEvent);
        this.onmessage?.({
          data: JSON.stringify(['EOSE', subId]),
        } as MessageEvent);
      }
      close(): void {
        this.onclose?.({} as CloseEvent);
      }
    }
    window.__syntheticSockets = [];
    window.WebSocket = SyntheticWebSocket as unknown as typeof WebSocket;
    function matchingEvents(events: unknown[], filters: unknown[]) {
      return events.filter((event) =>
        filters.some((filter) => matches(event, filter)),
      );
    }
    function matches(event: unknown, filter: unknown) {
      if (!record(event) || !record(filter)) return false;
      const kinds = Array.isArray(filter.kinds) ? filter.kinds : undefined;
      const authors = Array.isArray(filter.authors)
        ? filter.authors
        : undefined;
      return (
        (!kinds || kinds.includes(event.kind)) &&
        (!authors || authors.includes(event.pubkey))
      );
    }
    function record(value: unknown): value is Record<string, unknown> {
      return typeof value === 'object' && value !== null;
    }
  }, options);
}

declare global {
  interface Window {
    __syntheticSockets: unknown[];
  }
}
