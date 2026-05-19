import type { Page } from '@playwright/test';

export async function addReadonlyAccount(page: Page, pubkey: string) {
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Accounts' }).click();
  page.once('dialog', (dialog) => dialog.accept(pubkey));
  await page.getByRole('button', { name: 'Add read-only' }).click();
}

export async function openCleanWorkspace(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    window.__syntheticSockets.length = 0;
    await new Promise<void>((resolve) => {
      const request = indexedDB.open('lkjstr');
      request.onerror = () => resolve();
      request.onsuccess = () => {
        const db = request.result;
        const stores = Array.from(db.objectStoreNames);
        if (stores.length === 0) {
          db.close();
          resolve();
          return;
        }
        const transaction = db.transaction(stores, 'readwrite');
        for (const store of stores) transaction.objectStore(store).clear();
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          resolve();
        };
      };
    });
  });
  await page.reload();
}

export async function installSyntheticRelay(
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
      replies = 0;
      sent: string[] = [];

      constructor(readonly url: string) {
        window.__syntheticSockets.push(this);
        queueMicrotask(() => this.onopen?.({} as Event));
      }

      send(data: string): void {
        this.sent.push(data);
        const message = JSON.parse(data);
        if (message[0] !== 'REQ') return;
        queueMicrotask(() => this.reply(String(message[1]), message.slice(2)));
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
        this.replies += 1;
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
