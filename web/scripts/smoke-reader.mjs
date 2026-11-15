import { notesChecks } from './smoke-notes.ts';
import { seedLayouts } from './smoke-seed.mjs';

export async function realReaderChecks({
  browser,
  base,
  relayUrl,
  fake,
  fixture,
  fixtureSign,
  check,
  onReader,
  waitMs = 61_000,
}) {
  const readingNote = await fixtureSign({
    pubkey: fixture.note.pubkey,
    // Keep this fixture in signed-out Global's three-per-author slice during the arrival burst.
    created_at: Math.floor(Date.now() / 1000) + 3600,
    kind: 1,
    tags: [['content-warning', 'Reading fixture']],
    content:
      Array.from(
        { length: 30 },
        (_, i) =>
          `Paragraph ${i + 1}: a quiet page for a patient reader, with something different to say.`,
      ).join('\n\n') +
      `\nhttps://news.example/article\n${base}/icon-192.png\n${base}/__test_audio.wav`,
  });
  fake.add(readingNote);
  const noteContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  await seedLayouts(noteContext);
  await noteContext.addInitScript(
    (url) =>
      localStorage.setItem(
        'lkjstr:relays:',
        JSON.stringify([{ url, read: true, write: true, search: true }]),
      ),
    relayUrl,
  );
  await noteContext.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
  );
  const reader = await noteContext.newPage();
  onReader(reader);
  const before = await (await reader.request.get(`${base}/__test_preview_counts`)).json();
  await reader.goto(base);
  await reader
    .locator(`.note[data-note="${readingNote.id}"], .note[data-key="${readingNote.id}"]`)
    .waitFor();
  await reader.locator(`.note[data-note="${readingNote.id}"][data-previews]`).waitFor();
  const covered = await (await reader.request.get(`${base}/__test_preview_counts`)).json();
  check(
    'preview: one health probe per Worker start',
    covered.healthProbes === before.healthProbes + 1,
  );
  check(
    'preview: covered note sends no linked address',
    covered.previewRequests === before.previewRequests,
  );
  let arrival = 0;
  const updates = setInterval(() => {
    void fixtureSign({
      pubkey: fixture.note.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: `Live reading update ${++arrival}`,
    }).then((event) => fake.add(event));
  }, 8000);
  try {
    await notesChecks(reader, check, readingNote.id, waitMs);
  } finally {
    clearInterval(updates);
  }
  if (waitMs >= 60_000) check('reader: relay updates arrived during the minute', arrival >= 7);
  await noteContext.close();
  for (const mode of ['off', 'saver']) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'en-US',
    });
    await seedLayouts(ctx);
    await ctx.addInitScript(
      ({ url, mode }) => {
        localStorage.setItem(
          'lkjstr:relays:',
          JSON.stringify([{ url, read: true, write: true, search: true }]),
        );
        localStorage.setItem('lkjstr:settings', JSON.stringify({ linkPreviews: mode !== 'off' }));
        if (mode === 'saver')
          Object.defineProperty(navigator, 'connection', {
            value: { saveData: true, effectiveType: '4g' },
          });
      },
      { url: relayUrl, mode },
    );
    await ctx.route('**/*', (route) =>
      route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
    );
    const p = await ctx.newPage();
    const baseline = await (await p.request.get(`${base}/__test_preview_counts`)).json();
    await p.goto(base);
    const note = p.locator(`.note[data-note="${readingNote.id}"]`);
    await note.locator('.cw').click();
    await note.locator('.content').waitFor();
    await p.waitForTimeout(500);
    const after = await (await p.request.get(`${base}/__test_preview_counts`)).json();
    check(
      `preview: ${mode} draws no card and sends no address`,
      (await note.locator('.link-card').count()) === 0 &&
        after.previewRequests === baseline.previewRequests,
    );
    await ctx.close();
  }
}

export async function visitorRelayChecks({ page, relayUrl, check, launch }) {
  await launch('Settings', 'settings');
  const relayField = page.getByLabel('Relay address', { exact: true });
  await relayField.fill(`${relayUrl}/visitor`);
  await relayField.press('Enter');
  await page.waitForTimeout(500);
  check(
    'signed-out relay edit is saved',
    await page.evaluate(
      (url) =>
        JSON.parse(localStorage.getItem('lkjstr:relays:') ?? '[]').some(
          (r) => r.url.replace(/\/$/, '') === url,
        ),
      `${relayUrl}/visitor`,
    ),
  );
  await page.reload();
  await page.getByLabel('Relay address', { exact: true }).waitFor();
  // The form mounts before the engine returns its persisted relay rows.
  const visitorRelay = page.locator(
    `[data-entry="set.relayList"] .rhost[title^="${relayUrl}/visitor"]`,
  );
  await visitorRelay.waitFor();
  check('signed-out relay edit survives reload', (await visitorRelay.count()) === 1);
}
