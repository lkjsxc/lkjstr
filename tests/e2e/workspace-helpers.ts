import type { Locator, Page } from '@playwright/test';

export function pane(page: Page, index: number): Locator {
  return page.locator('.pane').nth(index);
}

export async function openNewTabOption(
  page: Page,
  option: string,
  paneIndex = 0,
) {
  const target = pane(page, paneIndex);
  await target.getByRole('button', { name: 'Open new tab' }).click();
  await target
    .locator('.new-tab')
    .last()
    .getByRole('button', { name: option, exact: true })
    .click();
}

export async function selectStartupTab(page: Page, tab: string, paneIndex = 1) {
  await pane(page, paneIndex)
    .locator('.tab-strip')
    .getByRole('button', { name: tab, exact: true })
    .click();
}
