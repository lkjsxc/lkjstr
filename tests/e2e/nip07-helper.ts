import type { Page } from '@playwright/test';
import type { Nip07Provider } from '../../src/lib/accounts/nip07';

export async function installNip07(page: Page, pubkey: string) {
  await page.addInitScript((key) => {
    window.nostr = {
      getPublicKey: async () => key,
      signEvent: async (event) => ({
        ...event,
        id: Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64),
        sig: 'f'.repeat(128),
      }),
    };
  }, pubkey);
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}
