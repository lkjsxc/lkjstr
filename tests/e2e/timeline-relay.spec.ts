import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';

test('timeline displays events from a synthetic relay', async ({ page }) => {
  const event = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'synthetic timeline note',
    },
    generateSecretKey(),
  );

  await page.addInitScript((fixtureEvent) => {
    type SyntheticSocket = {
      url: string;
      sent: string[];
      onopen: ((event: Event) => void) | null;
      onclose: ((event: CloseEvent) => void) | null;
      onmessage: ((event: MessageEvent) => void) | null;
    };
    const sockets: SyntheticSocket[] = [];
    class SyntheticWebSocket {
      url: string;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      sent: string[] = [];

      constructor(url: string) {
        this.url = url;
        sockets.push(this);
        queueMicrotask(() => this.onopen?.({} as Event));
      }

      send(data: string): void {
        this.sent.push(data);
        const message = JSON.parse(data);
        if (message[0] === 'REQ') {
          const subId = message[1];
          queueMicrotask(() => {
            this.onmessage?.({
              data: JSON.stringify(['EVENT', subId, fixtureEvent]),
            } as MessageEvent);
            this.onmessage?.({
              data: JSON.stringify(['EOSE', subId]),
            } as MessageEvent);
          });
        }
      }

      close(): void {
        this.onclose?.({} as CloseEvent);
      }
    }
    (window as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      SyntheticWebSocket as unknown as typeof WebSocket;
    (
      window as unknown as {
        __syntheticRelays: {
          sockets: SyntheticSocket[];
          receive: (data: unknown) => void;
        };
      }
    ).__syntheticRelays = {
      sockets,
      receive(data: unknown): void {
        sockets.forEach((socket) =>
          socket.onmessage?.({ data } as MessageEvent),
        );
      },
    };
  }, event);

  await page.goto('/');
  await expect(page.getByText('synthetic timeline note')).toBeVisible();
  await expect(page.getByText('EOSE')).toBeVisible();
});
