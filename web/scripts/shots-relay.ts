// The Relay tab: opened from the first relay of the Relays tab, its head and its first notes drawn.
import type { Page } from 'playwright-core';

export async function openRelay(page: Page): Promise<void> {
  await page.locator('.view[data-kind="relays"] .rrow').first().click();
  await page.waitForSelector('.view[data-kind="relay"]:visible .relayhead .rnips');
  await page.waitForSelector('.view[data-kind="relay"]:visible .note');
}
