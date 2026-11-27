// The relay disconnects on the first frame, then stores an exact event without replying.
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { accounts, compose, launch, setup } from './smoke-signer-support.mjs';

const noteText = 'note retry across broken wireless';
const refusedText = 'note retry hard refusal';
const discardedText = 'note retry user discard';
export const noteRetryCheckNames = [
  'post retry shows a quiet attempt count after disconnect and timeout',
  'post retry checkpoints the exact signed frame before the Worker restarts',
  'post retry survives a fresh Worker and browser profile without another signature',
  'post retry settles on duplicate OK and retains one event on the relay',
  'post retry stops on a hard refusal or a durable discard',
];

export function retryRelay(seed) {
  const frames = [];
  let recover = false;
  const relay = fakeRelay({
    publish(ws, event, add) {
      if (![noteText, refusedText, discardedText].includes(event.content)) return false;
      if (frames.length >= 50) throw new Error('retry fixture frame bound exceeded');
      frames.push(event);
      if (event.content === refusedText) {
        ws.send(JSON.stringify(['OK', event.id, false, 'blocked: local policy']));
      } else if (event.content === noteText) {
        if (frames.length === 1) ws.drop();
        else {
          const existed = relay.stored.some((row) => row.id === event.id);
          add(event);
          if (recover)
            ws.send(JSON.stringify(['OK', event.id, true, existed ? 'duplicate: stored' : '']));
        }
      }
      return true;
    },
  });
  relay.add(seed);
  return {
    relay,
    frames,
    recover: () => {
      recover = true;
    },
  };
}

function checkpoint([account, content]) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('lkjstr-wasm');
    open.onerror = reject;
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('kv');
      const get = tx.objectStore('kv').get(`note-outbox:${account}`);
      get.onerror = reject;
      get.onsuccess = () => {
        const entries = JSON.parse(get.result ?? '[]');
        resolve(entries.find((entry) => entry.event?.content === content)?.event);
      };
      tx.oncomplete = () => db.close();
    };
  });
}

export async function noteRetryChecks(options) {
  const { check, retry, shots, shot } = options;
  let signatures = 0;
  const signed = {
    ...options,
    sign: (event) => {
      if (event.kind === 1 && event.content === noteText) signatures++;
      return options.sign(event);
    },
  };
  let page = await setup(signed);
  const row = (text) => page.locator(`${compose} .cdraft`).filter({ hasText: text });
  const send = async (text) => {
    await page.locator(`${compose} textarea`).fill(text);
    await page.locator(compose).getByRole('button', { name: 'Post', exact: true }).click();
  };
  try {
    await page.locator('.acct.out').click();
    await page.locator(`${accounts} [data-f="extension"]`).click();
    await page.locator('.acct:not(.out)').waitFor();
    await launch(page, 'Post', 'compose');
    await send(noteText);
    await row(noteText)
      .getByText(/Retrying… \(attempt [1-9]\d*\)/)
      .waitFor({ timeout: 32_000 });
    check(
      noteRetryCheckNames[0],
      retry.frames.length >= 2 &&
        (await row(noteText).locator('.error').count()) === 0 &&
        (await row(noteText).getByRole('button', { name: 'Retry', exact: true }).count()) === 0,
    );
    if (shots) await shot(page, 'note-retrying.png');
    const first = retry.frames[0];
    const saved = await page.evaluate(checkpoint, [first.pubkey, noteText]);
    check(noteRetryCheckNames[1], saved?.id === first.id && saved?.sig === first.sig);
    const storageState = await page.context().storageState({ indexedDB: true });
    await page.context().close();
    page = await setup({ ...signed, storageState });
    if (!(await page.locator(`${compose} textarea`).count())) {
      const opened = page.locator('.tab[data-view^="compose"]').last();
      if (await opened.count()) await opened.click();
      else await launch(page, 'Post', 'compose');
    }
    const pending = row(noteText);
    await pending.waitFor();
    check(
      noteRetryCheckNames[2],
      (await pending.getAttribute('data-event')) === first.id && signatures === 1,
    );
    retry.recover();
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page
      .locator(`${compose} .csend[data-phase=sent][data-event="${first.id}"]`)
      .waitFor({ timeout: 35_000 });
    await pending.waitFor({ state: 'detached' });
    const frames = retry.frames.filter((event) => event.content === noteText);
    check(
      noteRetryCheckNames[3],
      signatures === 1 &&
        frames.length >= 3 &&
        frames.every((event) => JSON.stringify(event) === JSON.stringify(first)) &&
        retry.relay.stored.filter((event) => event.id === first.id).length === 1,
    );
    await send(refusedText);
    await row(refusedText).getByText('Refused by a relay.', { exact: true }).waitFor();
    await send(discardedText);
    const discarded = row(discardedText);
    await discarded.getByRole('button', { name: 'Remove', exact: true }).click();
    await discarded.waitFor({ state: 'detached' });
    const stopped = retry.frames.length;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(3000);
    check(
      noteRetryCheckNames[4],
      retry.frames.length === stopped &&
        retry.frames.filter((event) => event.content === refusedText).length === 1 &&
        (await row(refusedText).getByRole('button', { name: 'Retry', exact: true }).count()) === 0,
    );
  } finally {
    await page.context().close();
  }
}
