// One real thread, compared against verified native-eligible focus references.
import { writeFile } from 'node:fs/promises';
import { controlPages, delay } from './real-hour-public.mjs';
import { nativeEligibility, publicContext } from './real-hour-audit.mjs';
import { eventDigest } from './real-hour-network.mjs';
import { evidenceStatus, sourceFilter } from './real-hour-coverage.mjs';
export async function inspectThread({ page, cdp, account, directory }) {
  const focus = await page.evaluate(() => {
    const notes = [...document.querySelectorAll('.view[data-kind="home"] .note')].filter((note) => note.querySelector('.text'));
    const withReplies = notes.find((note) => {
      const number = Number((note.querySelector('.a-reply')?.textContent ?? '').replace(/[^0-9]/g, ''));
      return number > 0 && number <= 50;
    });
    return (withReplies ?? notes[0])?.dataset.note;
  });
  if (!focus) return { unavailable: 'No rendered Home note with a text body' };
  await page.evaluate((id) => document.querySelector(`.view[data-kind="home"] .note[data-note="${id}"] .text`)?.click(), focus);
  try {
    await page.locator('.view[data-kind="thread"] .th-focus').waitFor({ timeout: 45000 });
    await delay(20000); // Includes the engine page deadline; a missing relay still stays unknown.
    const targets = await cdp.sample();
    const querySnapshot = cdp.queryEvidence ? await cdp.queryEvidence()
      : { queries: await cdp.queries(), hostNetwork: cdp.networkEvidence?.summary() };
    const queries = querySnapshot.queries;
    const evidence = evidenceStatus(targets, querySnapshot.hostNetwork);
    const exact = queries.filter((q) => q.filters.some((f) => f.kinds?.length === 2 && f.kinds.includes(1) && f.kinds.includes(42) && f['#e']?.length === 1 && f['#e'][0] === focus));
    const relays = [...new Set(exact.map((q) => q.relay))];
    const controlStartedAt = Date.now();
    const control = await controlPages(relays, { kinds: [1], '#e': [focus] }, 3000);
    const verification = nativeEligibility(control.events, await publicContext(page), {
      thread: { query: { source: 'thread', account: account.pubkey, id: focus } },
    });
    const policy = verification.eligibility.thread;
    const replies = control.events.filter((event) => policy.eligible.includes(event.id));
    const drawn = await page.evaluate(() => [...document.querySelectorAll('.view[data-kind="thread"] .note')].map((note) => note.dataset.note));
    const observed = await page.evaluate(() => globalThis.__realHour?.seen.thread ?? []);
    await writeFile(`${directory}/thread-public-control.json`, JSON.stringify(control));
    const missing = replies.filter((event) => !observed.includes(event.id));
    const receiptEvidence = missing.map(event => {
      const receipts = cdp.networkEvidence?.forEvent(event.id) ?? [];
      const matching = receipts.filter(item => item.digest === eventDigest(event));
      return { id: event.id, matchingPayloads: matching.length,
        receivedBeforeControl: matching.filter(item => item.at <= controlStartedAt).length,
        sourceReceiptsBeforeControl: matching.filter(item => item.at <= controlStartedAt &&
          item.request.filters.some(filter => sourceFilter(filter, 'thread', account, focus))).length,
        queryReferences: matching.slice(0, 100).map(({ request, ...item }) => item),
        truncated: matching.length > 100 };
    });
    return { focus, relays, ...evidence, querySnapshotAt: querySnapshot.at, controlStartedAt, receiptEvidence, exactQueries: exact, controlPages: control.pages, verifiedEligibleReferences: replies.length, excluded: policy.excluded,
      drawnRows: drawn.length, observedRows: observed.length,
      missingCandidates: missing.map((event) => event.id),
      rejectedSignatures: verification.rejected, interpretation: 'Focus #e control, native thread ancestry/filter/mute eligibility; deeper replies without the focus tag and relay completeness remain outside this comparison.' };
  } catch (error) { return { focus, failure: String(error).slice(0, 500) }; }
  finally {
    const close = page.locator('.tab.active[data-view^="thread"] > .x').first();
    if (await close.count()) await close.click();
    const home = page.locator('.tab[data-view="home"]').first();
    if (await home.count()) await home.click();
  }
}
