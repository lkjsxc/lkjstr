import { appendFileSync } from 'node:fs';
import { installExtension } from './smoke-visitors.mjs';
import { wishFaces } from './smoke-wish-faces.mjs';
import { wishFields } from './smoke-wish-fields.mjs';
import { wishNotifications } from './smoke-wish-notifications.mjs';
import {
  front,
  probe,
  seedWishes,
  slowly,
  view,
  wishFailure,
  wishRoot,
  wishShot,
} from './smoke-wish-support.mjs';
export async function wishes({
  browser,
  base,
  check,
  real,
  sign,
  relayUrl,
  pubkey,
  events,
  errors = [],
}) {
  const engine = real ? 'real' : 'mock';
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      locale: 'en-US',
      colorScheme: 'dark',
    });
    await seedWishes(ctx);
    await ctx.route('**/*', (route) =>
      route.request().url().startsWith(base)
        ? route.continue()
        : route.fulfill({
            status: 200,
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="teal"/></svg>',
          }),
    );
    if (real) {
      await ctx.exposeFunction('fixtureSign', sign);
      await installExtension(ctx, relayUrl, pubkey, errors);
    } else await ctx.routeWebSocket('**/*', (socket) => socket.close());
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(String(e)));
    const fact = (name, ok) => {
      appendFileSync(
        `${wishRoot}wishes-progress.log`,
        `${ok ? 'ok' : 'FAIL'} ${engine} ${width} ${name}\n`,
      );
      check(`wish ${engine} ${width}: ${name}`, ok);
    };
    try {
      await page.goto(base);
      await page.locator('.note').first().waitFor();
      if (real) {
        await front(page, 'account');
        await page.locator(`${view('account')} [data-f="extension"]`).click();
        await page.locator('.acct:not(.out)').waitFor();
      }
      await front(page, 'global');
      const notes = await probe(page, { source: 'global', account: real ? pubkey : undefined });
      const target =
        notes.find((r) => r.kind === 'note' && r.reactions.length) ??
        notes.find((r) => r.kind === 'note');
      const note = page.locator(`${view('global')} .note[data-key="${target.id}"]`);
      if (real) await events({ target, kind: 'reactions', width });
      await note.locator('.rchip').first().waitFor();
      fact(
        '1 aliases never draw a raw plus or minus',
        !(await note.locator('.rchip').allTextContents()).some((s) => /^[+-]/.test(s.trim())),
      );
      const heart = note.locator('.rchip[data-emoji="❤️"]');
      const wasLiked = await heart.getAttribute('aria-pressed');
      await heart.click();
      await page.waitForFunction(
        ({ id, was }) =>
          document
            .querySelector(`.note[data-key="${id}"] .rchip[data-emoji="❤️"]`)
            ?.getAttribute('aria-pressed') !== was,
        { id: target.id, was: wasLiked },
      );
      await page.waitForTimeout(100);
      fact(
        '1 heart chip toggles own like',
        (await note.locator('.rchip[data-emoji="❤️"]').getAttribute('aria-pressed')) !== wasLiked,
      );
      await note.locator('.rchip[data-emoji="❤️"]').click();
      await wishShot(page, 1, engine, width);
      const geometry = await note.locator('.acts').evaluate((el) => {
        const icons = [...el.querySelectorAll('.a-smile svg,.a-bookmark svg,.a-more svg')]
          .filter((x) => x.getBoundingClientRect().width)
          .map((x) => x.getBoundingClientRect().left);
        return {
          width: el.getBoundingClientRect().width,
          gaps: icons.slice(1).map((x, i) => x - icons[i]),
          inside:
            el.getBoundingClientRect().right <= el.closest('.view').getBoundingClientRect().right,
        };
      });
      fact(
        '8 action icons share room and remain inside the tile',
        geometry.inside && (geometry.width < 400 || geometry.gaps.every((n) => n >= 44)),
      );
      await wishShot(page, 8, engine, width);
      await wishFields({ page, width, real, relayUrl, events, fact });
      await front(page, 'compose');
      const area = page.locator(`${view('compose')} textarea`);
      const suggestions = await probe(page, {
        source: 'people',
        text: real ? 'engine' : 'ao',
        account: real ? pubkey : undefined,
      });
      const candidate = suggestions.find((r) => r.kind === 'person');
      const prefix = real ? 'eng' : 'ao';
      await area.fill(`@${prefix}`);
      await page.locator('.mention-menu:not([hidden]) [role="option"]').first().waitFor();
      fact(
        '5 at most six local mention choices',
        (await page.locator('.mention-menu:not([hidden]) [role="option"]').count()) <= 6,
      );
      await wishShot(page, 5, engine, width);
      await area.press('Enter');
      fact(
        '5 Enter inserts a named mention',
        (await area.inputValue()).startsWith('@') &&
          (await area.inputValue()).endsWith(' ') &&
          (await page.locator(`${view('compose')} .mention-preview`).innerText()).includes('@'),
      );
      await area.evaluate((el) => {
        el.setSelectionRange(2, 2);
        el.setRangeText('x', 2, 2, 'end');
        el.dispatchEvent(new Event('input'));
      });
      fact(
        '5 editing inside a name dissolves the mention',
        (await page.locator(`${view('compose')} .mention-preview`).innerText()) === '',
      );
      await area.fill(`@${prefix}`);
      await page.locator('.mention-menu:not([hidden])').waitFor();
      await area.press('Escape');
      fact('5 Escape leaves typed text', (await area.inputValue()) === `@${prefix}`);
      await area.fill(`nostr:${candidate.author.npub}`);
      await page.waitForFunction(
        (sel) =>
          document
            .querySelector(`${sel.replace(':visible', '')} .mention-preview`)
            ?.textContent?.includes('@'),
        view('compose'),
      );
      fact('5 pasted person address has a named preview', true);
      await area.fill(`@${prefix}`);
      await page.locator('.mention-menu:not([hidden])').waitFor();
      await area.press('Enter');
      await area.pressSequentially(`wish queued note ${candidate.author.npub}`);
      // The mock finishes in 2.4 seconds; real signing is held before returning to the engine.
      if (real)
        await page.evaluate(() => {
          const old = window.nostr.signEvent;
          window.wish.release = null;
          window.nostr.signEvent = (event) =>
            new Promise((done) => {
              window.wish.release = () => old(event).then(done);
            });
        });
      await page
        .locator(view('compose'))
        .getByRole('button', { name: 'Post', exact: true })
        .click();
      fact(
        '3 Post frees and focuses the field in the same turn',
        (await area.inputValue()) === '' &&
          (await area.evaluate((el) => el === document.activeElement)),
      );
      await area.fill('next note');
      fact(
        '3 another Post is ready while the first is pending',
        (await page
          .locator(view('compose'))
          .getByRole('button', { name: 'Post', exact: true })
          .isEnabled()) &&
          (await page.locator(`${view('compose')} .outbox`).innerText()).includes(
            'wish queued note',
          ),
      );
      await slowly(
        page,
        area,
        'next note',
        fact,
        '2 composer',
        real ? () => events({ kind: 'arrival', width }) : undefined,
      );
      if (real) {
        await page.waitForFunction(() => !!window.wish.release);
        await page.evaluate(() => window.wish.release());
        fact(
          '5 Post expands selected and pasted mentions with p tags',
          await events({ kind: 'mentionSent', author: candidate.author, width }),
        );
      }
      await page.reload();
      await page.locator(`${view('compose')} textarea`).waitFor();
      fact(
        '3 the next note survives reload',
        (await page.locator(`${view('compose')} textarea`).inputValue()) === 'next note',
      );
      await front(page, 'global');
      await page
        .locator(`${view('global')} .note .name`)
        .first()
        .click();
      await page.locator('.profile').waitFor();
      await page.locator('.profile .their-home').click();
      await page.locator(view('their-home')).waitFor();
      fact(
        '4 profile opens its owner’s Home with filters',
        (await page.locator(`${view('their-home')} .fbar`).count()) === 1 &&
          (await page.locator('.pane.cur .tab.active > span').innerText()).endsWith("'s Home"),
      );
      await page.reload();
      await page.locator(view('their-home')).waitFor();
      fact('4 Their Home survives reload', true);
      await wishNotifications({ page, real, events, width, fact, engine });
      await front(page, 'compose');
      fact(
        '7 account face and posting face use the same current profile',
        (await page.locator('.acct [data-face]').getAttribute('data-face')) ===
          (await page.locator(`${view('compose')} .cwho [data-face]`).getAttribute('data-face')),
      );
      await wishFaces({ page, real, events, width, fact });
      await front(page, 'account');
      for (let i = 0; i < 2 && (await page.locator('.acct:not(.out)').count()); i++) {
        await page.locator(`${view('account')} .arow.on .ahead [data-f="remove"]`).click();
        if (await page.locator(`${view('account')} .aask [data-f="remove"]`).count())
          await page.locator(`${view('account')} .aask [data-f="remove"]`).click();
        await page.waitForTimeout(200);
      }
      await page.locator('.acct.out').waitFor();
      await front(page, 'global');
      await page
        .locator(`${view('global')} .note .name`)
        .first()
        .click();
      await page.locator('.profile .their-home').click();
      await page
        .locator(`${view('their-home')} .note`)
        .first()
        .waitFor();
      if (!real)
        await page.evaluate(() => {
          const config = JSON.parse(localStorage.getItem('lkjstr:mock') ?? '{}');
          localStorage.setItem('lkjstr:mock', JSON.stringify({ ...config, accounts: 'none' }));
        });
      await page.reload();
      await page
        .locator(`${view('their-home')} .note`)
        .first()
        .waitFor();
      fact(
        '4 Their Home works and survives reload signed out',
        (await page.locator('.acct.out').count()) === 1,
      );
      fact(
        '9 no raw keys in the reader’s text',
        !/[0-9a-f]{64}/.test(await page.locator('body').innerText()),
      );
    } catch (error) {
      await wishFailure(page, engine, width, error);
    } finally {
      await ctx.close();
    }
  }
}
