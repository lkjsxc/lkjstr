import { smokePath } from './smoke-output.ts';
import { compose } from './smoke-signer-support.mjs';
import { queuedUploadChecks } from './smoke-upload-checks.mjs';

export async function queuedUploadScenarios({ page, check, media, fake, file }) {
  const view = page.locator(compose);
  const area = view.locator('textarea');
  const post = view.getByRole('button', { name: 'Post', exact: true });
  const input = view.locator('input[type=file]');
  const waiting = view.locator('.cupload[data-phase=waiting]');
  const failed = view.locator('.cupload[data-phase=failed]');
  const done = view.locator('.thumb.done');
  const sent = view.locator('.csend[data-phase=sent]');
  const calls = () => page.evaluate(() => window.uploadPostCalls);
  const initial = await calls();
  const protocol = 'blossom';
  const origin = media.origins[protocol];
  const attachHeld = async (target = protocol, field = input) => {
    media.set(target, 'ok');
    await page.evaluate((url) => {
      window.uploadTarget = url;
    }, media.origins[target]);
    const start = media.requests.length;
    const release = media.hold(target);
    await field.setInputFiles(file);
    for (let n = 0; n < 400; n++) {
      if (media.requests.slice(start).some((r) => r.protocol === target && r.valid === true))
        return release;
      await page.waitForTimeout(25);
    }
    release();
    throw new Error(`upload request did not reach the ${target} fixture`);
  };
  const signatures = async (n) => {
    const count = await calls();
    return count.publish === initial.publish + n && count.sign === initial.sign + n;
  };
  const relayed = async (text, origins = [origin]) => {
    await sent.waitFor();
    const id = await sent.getAttribute('data-event');
    const event = fake.published.find((item) => item.id === id);
    const urls = event?.content.match(/https:\/\/\S+/g) ?? [];
    return (
      urls.length === origins.length &&
      event.content.trim() === [text, ...urls].filter(Boolean).join('\n') &&
      urls.every(
        (url, i) =>
          url.startsWith(`${origins[i]}/`) &&
          event.tags.some((tag) => tag[0] === 'imeta' && tag.includes(`url ${url}`)),
      )
    );
  };

  await area.fill('');
  await page.evaluate(() => {
    window.holdUploadPost = true;
  });
  const succeed = await attachHeld();
  await post.click();
  await waiting.waitFor();
  await area.press('Control+Enter');
  check(queuedUploadChecks[0], (await post.isDisabled()) && (await signatures(0)));
  if (process.env.LKJSTR_SHOTS === '1')
    await view.screenshot({ path: smokePath('screens/upload-post-waiting-en.png') });
  succeed();
  await page.waitForFunction(() => typeof window.releaseUploadPost === 'function');
  check(
    queuedUploadChecks[1],
    (await waiting.count()) === 0 &&
      (await view.locator('.cdraft[data-phase=signing]').isVisible()) &&
      (await signatures(1)),
  );
  await page.evaluate(() => {
    window.holdUploadPost = false;
    window.releaseUploadPost();
  });
  check(queuedUploadChecks[2], (await relayed('')) && (await signatures(1)));

  const text = 'queued upload fixture draft';
  await area.fill(text);
  const refuse = await attachHeld();
  const other = await attachHeld('nip96');
  await area.press('Control+Enter');
  await waiting.waitFor();
  refuse('refuse');
  const attachment = view.locator('.thumb.failed');
  await attachment.waitFor();
  await failed.waitFor();
  check(
    queuedUploadChecks[3],
    (await signatures(1)) &&
      fake.published.every((event) => !event.content.includes(text)) &&
      (await area.inputValue()) === text &&
      (await attachment.innerText()).includes(file.name) &&
      (await view.locator('.thumb:not(.done, .failed)').count()) === 1 &&
      (await post.isDisabled()),
  );
  other();
  await done.waitFor();
  await attachment.getByRole('button', { name: 'Retry', exact: true }).click();
  await done.nth(1).waitFor();
  if (!(await signatures(1))) throw new Error('file retry restarted the canceled Post');
  await post.click();
  check(
    queuedUploadChecks[4],
    (await relayed(text, [origin, media.origins.nip96])) && (await signatures(2)),
  );

  await area.fill('kept after removal');
  const remove = await attachHeld();
  await post.click();
  await waiting.waitFor();
  await view.locator('.thumb button.x').click();
  remove();
  await failed.waitFor();
  check(
    queuedUploadChecks[5],
    (await area.inputValue()) === 'kept after removal' && (await signatures(2)),
  );

  const edit = await attachHeld();
  await post.click();
  await waiting.waitFor();
  await area.fill('edited while uploading');
  await waiting.waitFor({ state: 'hidden' });
  await post.click();
  await waiting.getByRole('button', { name: 'Cancel', exact: true }).click();
  edit();
  await done.waitFor();
  check(
    queuedUploadChecks[6],
    (await waiting.count()) === 0 &&
      (await area.inputValue()) === 'edited while uploading' &&
      (await signatures(2)),
  );
  await done.locator('button.x').click();

  const postTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await page.locator('.tab[data-view="global"]').click();
  const parent = page
    .locator('.pane.cur .view[data-kind="global"]:visible .note[data-note]')
    .filter({ has: page.locator('.text', { hasText: /\S/ }) })
    .first();
  const parentId = await parent.getAttribute('data-note');
  await parent.locator('.text').click();
  const thread = page.locator('.pane.cur .view[data-kind="thread"]:visible');
  const reply = thread.locator('.tsay');
  const replyText = 'queued upload fixture thread reply';
  await reply.locator('textarea').fill(replyText);
  const replyUpload = await attachHeld(protocol, reply.locator('input[type=file]'));
  await reply.getByRole('button', { name: 'Reply', exact: true }).click();
  await reply.locator('.cupload[data-phase=waiting]').waitFor();
  const waited = await signatures(2);
  await page.evaluate(() => {
    window.holdUploadPost = true;
    window.releaseUploadPost = undefined;
  });
  replyUpload();
  await page.waitForFunction(() => typeof window.releaseUploadPost === 'function');
  // P2 puts the one visible wait line in the extension's retained draft, not the generic status.
  const draft = reply.locator('.cdraft[data-phase=signing]');
  const posting =
    (await draft.isVisible()) && !(await reply.locator('.csend[data-phase=signing]').isVisible());
  await draft.locator('button.signer-cancel').waitFor();
  const approval =
    (await draft.getAttribute('data-signer-wait')) === 'approval' &&
    (await draft.getByRole('button', { name: 'Cancel', exact: true }).isEnabled());
  await page.evaluate(() => {
    window.holdUploadPost = false;
    window.releaseUploadPost();
  });
  await reply.locator('.csend[data-phase=sent]').waitFor({ state: 'attached' });
  await thread.locator('.th-reply').filter({ hasText: replyText }).waitFor();
  const event = fake.published.find((item) => item.content.startsWith(`${replyText}\n`));
  check(
    queuedUploadChecks[7],
    waited &&
      posting &&
      approval &&
      (await signatures(3)) &&
      event?.tags.some((tag) => tag[0] === 'e' && tag[1] === parentId) &&
      event.tags.some((tag) => tag[0] === 'imeta' && tag[1]?.startsWith(`url ${origin}/`)),
  );
  await page.locator(`.tab[data-view="${postTab}"]`).click();
}
