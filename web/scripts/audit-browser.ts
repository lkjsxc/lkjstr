// Browser audit isolation must leave Chromium's HTTP cache enabled (no request routing).
import type { BrowserContext, Page } from 'playwright-core';

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export function rebaseStorageState(state: StorageState, base: string): StorageState {
  if (state.origins.length !== 1) throw new Error('Expected one saved audit origin');
  const old = new URL(state.origins[0]!.origin);
  if (old.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(old.hostname))
    throw new Error('Expected a loopback audit origin');
  return { ...state, origins: state.origins.map((entry) => ({ ...entry, origin: base })) };
}

// Applies to documents and their Workers, including fetch, WebSocket, images and media.
export function auditCsp(relay?: string): string {
  if (relay && !/^ws:\/\/127\.0\.0\.1:\d+$/.test(relay))
    throw new Error('Expected a loopback fixture relay');
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self'${relay ? ` ${relay}` : ''}`,
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Fetch an already loaded historical script and require Chromium to report a real cache hit. */
export async function historicalCacheHit(page: Page): Promise<boolean> {
  const url = await page
    .locator('script[src]')
    .first()
    .evaluate((el) => (el as HTMLScriptElement).src);
  const cdp = await page.context().newCDPSession(page);
  const requests = new Set<string>();
  const cached = new Set<string>();
  cdp.on('Network.requestWillBeSent', (event) => {
    if (event.request.url === url) requests.add(event.requestId);
  });
  cdp.on('Network.requestServedFromCache', (event) => cached.add(event.requestId));
  cdp.on('Network.responseReceived', (event) => {
    if (event.response.fromDiskCache) cached.add(event.requestId);
  });
  try {
    await cdp.send('Network.enable');
    await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Historical script fetch failed');
      await response.arrayBuffer();
    }, url);
    return [...requests].some((id) => cached.has(id));
  } finally {
    await cdp.detach();
  }
}
