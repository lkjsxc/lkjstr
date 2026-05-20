import { expect, type Page } from '@playwright/test';

export async function addReadonlyAccount(page: Page, pubkey: string) {
  await page.getByRole('button', { name: 'Open new tab' }).first().click();
  await page.getByRole('button', { name: 'Accounts' }).click();
  page.once('dialog', (dialog) => dialog.accept(pubkey));
  await page.getByRole('button', { name: 'Add read-only' }).click();
  await expect(page.getByText('readonly')).toBeVisible();
}

export async function waitForSyntheticEvent(page: Page, eventId: string) {
  await page.waitForFunction(
    ({ eventId }) => {
      const record = (value: unknown): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null;
      return window.__syntheticSockets.some(
        (socket) =>
          record(socket) &&
          Array.isArray(socket.delivered) &&
          socket.delivered.includes(eventId),
      );
    },
    { eventId },
  );
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
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      readyState = SyntheticWebSocket.CONNECTING;
      replies = 0;
      sent: string[] = [];
      delivered: string[] = [];
      published: unknown[] = [];
      listeners = new Map<string, Set<(event: Event) => void>>();

      constructor(readonly url: string) {
        window.__syntheticSockets.push(this);
        queueMicrotask(() => {
          this.readyState = SyntheticWebSocket.OPEN;
          this.dispatch('open', {} as Event);
        });
      }

      addEventListener(type: string, listener: (event: Event) => void): void {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(
        type: string,
        listener: (event: Event) => void,
      ): void {
        this.listeners.get(type)?.delete(listener);
      }

      send(data: string): void {
        this.sent.push(data);
        const message = parseClientMessage(data);
        if (message[0] === 'EVENT') {
          const event = message[1];
          this.published.push(event);
          if (record(event) && typeof event.id === 'string')
            queueMicrotask(() => this.message(['OK', event.id, true, '']));
          return;
        }
        if (message[0] !== 'REQ') return;
        queueMicrotask(() => this.reply(String(message[1]), message.slice(2)));
      }

      reply(subId: string, filters: unknown[]): void {
        if (relayOptions.closed)
          this.message(['CLOSED', subId, relayOptions.closed[1]]);
        for (const event of matchingEvents(relayOptions.events, filters)) {
          if (record(event) && typeof event.id === 'string')
            this.delivered.push(event.id);
          this.message(['EVENT', subId, event]);
        }
        this.message(['EOSE', subId]);
        this.replies += 1;
      }

      message(value: unknown[]): void {
        this.dispatch('message', {
          data: JSON.stringify(value),
        } as MessageEvent);
      }

      close(): void {
        this.readyState = SyntheticWebSocket.CLOSED;
        this.dispatch('close', {} as CloseEvent);
      }

      dispatch(type: string, event: Event): void {
        if (type === 'open') this.onopen?.(event);
        if (type === 'message') this.onmessage?.(event as MessageEvent);
        if (type === 'close') this.onclose?.(event as CloseEvent);
        if (type === 'error') this.onerror?.(event);
        for (const listener of this.listeners.get(type) ?? []) listener(event);
      }
    }
    window.__syntheticSockets = [];
    window.WebSocket = SyntheticWebSocket as unknown as typeof WebSocket;
    function matchingEvents(events: unknown[], filters: unknown[]) {
      return events.filter((event) =>
        filters.some((filter) => matches(event, filter)),
      );
    }
    function parseClientMessage(data: string): unknown[] {
      try {
        const message = JSON.parse(data);
        return Array.isArray(message) ? message : [];
      } catch {
        return [];
      }
    }
    function matches(event: unknown, filter: unknown) {
      if (!record(event) || !record(filter)) return false;
      const kinds = Array.isArray(filter.kinds) ? filter.kinds : undefined;
      const authors = Array.isArray(filter.authors)
        ? filter.authors
        : undefined;
      const ids = Array.isArray(filter.ids) ? filter.ids : undefined;
      const tags = Array.isArray(filter['#e']) ? filter['#e'] : undefined;
      const since = Number.isFinite(filter.since) ? Number(filter.since) : 0;
      const until = Number.isFinite(filter.until)
        ? Number(filter.until)
        : Number.MAX_SAFE_INTEGER;
      return (
        (!ids || ids.includes(event.id)) &&
        (!kinds || kinds.includes(event.kind)) &&
        (!authors || authors.includes(event.pubkey)) &&
        (!tags ||
          (Array.isArray(event.tags) &&
            event.tags.some(
              (tag) => Array.isArray(tag) && tags.includes(tag[1]),
            ))) &&
        Number(event.created_at) >= since &&
        Number(event.created_at) < until
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
