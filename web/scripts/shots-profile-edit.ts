// P1 scenes (interface-profile.md): the reader's own header with Edit profile, the form, an upload in progress
// and a refused save. Each fails on horizontal scrolling.
import type { Page } from 'playwright-core';

type Scene = (name: string, path: string, act: (page: Page) => Promise<void>) => Promise<void>;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPhfDwAEiAH+Y2r1VwAAAABJRU5ErkJggg==',
  'base64',
);

export async function profileEditShots(scene: Scene): Promise<void> {
  const view = '.view.pedit:visible';
  const open = async (page: Page): Promise<void> => {
    await page.locator('.profile [data-f="edit-profile"]').first().click();
    await page.locator(`${view} [data-f="name"]:enabled`).waitFor();
  };
  const flat = async (page: Page): Promise<void> => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error('horizontal overflow');
  };
  await scene('profile-own', '/p/komorebi', async (page) => {
    await page.locator('.profile [data-f="edit-profile"]').first().waitFor();
    await flat(page);
  });
  await scene('profile-edit', '/p/komorebi', async (page) => {
    await open(page);
    await page.locator(`${view} [data-f="website"]`).fill('example.jp');
    await page.locator(`${view} [data-f="save"]`).click();
    await page.locator(`${view} [data-f="website-error"]:not(:empty)`).waitFor();
    await flat(page);
  });
  await scene('profile-edit-uploading', '/p/komorebi', async (page) => {
    await open(page);
    await page
      .locator(`${view} [data-f="banner-file"]`)
      .setInputFiles({ name: 'band.png', mimeType: 'image/png', buffer: PNG });
    await page.locator(`${view} [data-f="banner-status"] .prog`).waitFor();
    await page.waitForTimeout(450);
    await flat(page);
  });
  await scene('profile-edit-failed', '/p/komorebi', async (page) => {
    await open(page);
    await page.locator(`${view} [data-f="about"]`).fill('Free airdrop');
    await page.locator(`${view} [data-f="save"]`).click();
    await page.locator(`${view} .asaid:not(:empty)`).waitFor();
    await flat(page);
  });
}
