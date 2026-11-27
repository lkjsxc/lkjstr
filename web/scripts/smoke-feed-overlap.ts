import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, devices, webkit } from 'playwright-core';
import { browserTmp } from './browser-tmp.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
process.env.TMPDIR = browserTmp(resolve(here, '../../tmp/feed-overlap-browser'));
const [{ outputFiles }, styles] = await Promise.all([
  build({ entryPoints: [resolve(here, 'feed-overlap-fixture.ts')], bundle: true, write: false }),
  Promise.all(
    ['ui', 'notes', 'views', 'people'].map((name) =>
      readFile(resolve(here, `../src/ui/${name}.css`), 'utf8'),
    ),
  ),
]);
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end(
      '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<link rel="stylesheet" href="/fixture.css"><script defer src="/fixture.js"></script>',
    );
  } else if (request.url === '/fixture.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(outputFiles[0]?.contents);
  } else if (request.url === '/fixture.css') {
    response.setHeader('Content-Type', 'text/css');
    response.end(styles.join('\n'));
  } else response.writeHead(404).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
const failures: string[] = [];
type Frame = {
  phase: string;
  scroll: number;
  overlap: number;
  anchorTop: number;
  viewTop: number;
  barBottom: number;
  freshTop?: number;
  railTop?: number;
};
const report: { browser: string; feed: string; frames: Frame[] }[] = [];
try {
  for (const [name, type, phone] of [
    ['Chromium desktop', chromium, false],
    ['WebKit iPhone 13', webkit, true],
  ] as const) {
    const browser = await type.launch(
      phone
        ? {}
        : {
            executablePath:
              process.env.LKJSTR_CHROME ??
              `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
            args: ['--no-sandbox'],
          },
    );
    try {
      const context = await browser.newContext(phone ? devices['iPhone 13'] : {});
      await context.route('**/*', (route) =>
        route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
      );
      const page = await context.newPage();
      await page.goto(base);
      for (const kind of [
        'home',
        'global',
        'notifications',
        'profile',
        'their-home',
        'hashtag',
        'bookmarks',
        'search',
      ]) {
        const frames = await page.evaluate(
          ([feed, touch]) => {
            const fixture = window as unknown as {
              exercise(feed: string, touch: boolean): Promise<Frame[]>;
            };
            return fixture.exercise(feed, touch);
          },
          [kind, phone] as const,
        );
        const check = (ok: boolean, subject: string) => {
          if (!ok) failures.push(`${name}, ${kind}: ${subject}`);
        };
        const [head, bottom, before, after] = frames;
        const trimStart = frames.at(-2);
        const trimEnd = frames.at(-1);
        assert.ok(head && bottom && before && after && trimStart && trimEnd);
        report.push({ browser: name, feed: kind, frames });
        check(
          head.barBottom > head.viewTop + 10 && bottom.barBottom < bottom.viewTop,
          'bar scrolls away',
        );
        check(
          Math.abs(before.anchorTop - after.anchorTop) <= 1 && before.scroll === after.scroll,
          'prepend holds the reading anchor without writing the scroll',
        );
        check(
          Math.abs(trimStart.anchorTop - trimEnd.anchorTop) <= 1 &&
            trimStart.scroll === trimEnd.scroll,
          'window trim holds the reading anchor without writing the scroll',
        );
        for (const frame of frames) {
          check(frame.overlap <= 1, `${frame.phase}: bar overlaps a row by ${frame.overlap}px`);
          if (kind !== 'bookmarks')
            check(
              Math.abs((frame.railTop ?? Infinity) - frame.viewTop) <= 1,
              `${frame.phase}: rail stays pinned`,
            );
        }
        if (kind === 'home' || kind === 'notifications') {
          check(
            after.freshTop !== undefined && Math.abs(after.freshTop - after.viewTop - 8) <= 1,
            'new-notes pill stays pinned when the bar has left the screen',
          );
          for (const frame of frames)
            if (frame.freshTop !== undefined)
              check(
                frame.freshTop >= frame.barBottom + 7,
                `${frame.phase}: new-notes pill clears the bar`,
              );
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
}
if (process.env.LKJSTR_FEED_OVERLAP_REPORT) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(
    process.env.LKJSTR_FEED_OVERLAP_REPORT,
    JSON.stringify({ report, failures }, null, 2),
  );
}
if (failures.length) throw new Error(failures.join('\n'));
console.log('ok smoke feed overlap (Chromium desktop and WebKit iPhone 13)');
