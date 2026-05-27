import { expect, vi } from 'vitest';
import { feedDisplayKinds } from '../../../src/lib/events/feed-kinds';
import { parsedSocketMessage, sockets } from './fake-websocket';

export function openAllSockets(): void {
  for (const socket of sockets) socket.open();
}

export async function waitForSub(subId: string, exact = false): Promise<void> {
  await vi.waitFor(
    () => {
      openAllSockets();
      expect(parsedSent(subId, exact)).toBeTruthy();
    },
    { timeout: 5000 },
  );
}

export function parsedSent(subId: string, exact = false): unknown {
  return parsedSocketMessage(subId, exact);
}

export function expectNoteReq(
  subId: string,
  authors: string[],
  options: { readonly exact?: boolean; readonly withUntil?: boolean } = {},
): void {
  const message = parsedSent(subId, options.exact) as unknown[];
  expect(message?.[0]).toBe('REQ');
  const filters = (message?.slice(2) ?? []) as Array<{
    kinds?: number[];
    authors?: string[];
    limit?: number;
    since?: number;
    until?: number;
  }>;
  for (const author of authors) {
    const hit = filters.find((filter) => filter.authors?.includes(author));
    expect(hit?.kinds).toEqual([...feedDisplayKinds]);
    if (!options.exact) expect(hit?.limit).toBe(30);
    if (options.withUntil) {
      expect(typeof hit?.since).toBe('number');
      expect(typeof hit?.until).toBe('number');
    } else {
      expect(hit?.until).toBeUndefined();
    }
  }
}
