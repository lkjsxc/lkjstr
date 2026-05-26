import { expect, type Page } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from '../../src/lib/protocol';

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const doc = document.documentElement;
        const panes = [...document.querySelectorAll('.pane, .pane-body')];
        return [
          doc.scrollWidth <= doc.clientWidth + 1,
          ...panes.map((pane) => pane.scrollWidth <= pane.clientWidth + 1),
        ].every(Boolean);
      }),
    )
    .toBe(true);
}

export function syntheticNotes(
  count: number,
  key = generateSecretKey(),
  prefix = 'layout fit note',
) {
  return Array.from({ length: count }, (_, index) =>
    finalizeEvent(
      {
        created_at: Math.floor(Date.now() / 1000) - index,
        kind: 1,
        tags: [],
        content: `${prefix} ${index}`,
      },
      key,
    ),
  );
}
