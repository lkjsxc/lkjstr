// Contact sheets are review artifacts only; the application page is never restyled.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import type { ShotWriter } from './shots-provenance.ts';

export async function accountFailureSheet(
  browser: Browser,
  out: string,
  tag: string,
  names: readonly string[],
  shot: ShotWriter,
): Promise<void> {
  const cards = names
    .map((name) => {
      const stem = `${name}-${tag}`;
      const data = readFileSync(join(out, `${stem}.png`)).toString('base64');
      return `<figure><figcaption>${stem}</figcaption><img src="data:image/png;base64,${data}"></figure>`;
    })
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><title>Account failure review</title>
<style>body{margin:16px;background:#eee;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}figcaption{padding:8px 0}img{width:100%;display:block}</style><main>${cards}</main>`;
  const stem = join(out, `account-failure-contact-sheet-${tag}`);
  writeFileSync(`${stem}.html`, html);
  shot.stamp(`${stem}.html`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.route('**/*', (route) => route.abort());
    await page.setContent(html);
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
    await shot.screenshot(page, { path: `${stem}.jpg`, type: 'jpeg', quality: 70, fullPage: true });
  } finally {
    await page.close();
  }
}
