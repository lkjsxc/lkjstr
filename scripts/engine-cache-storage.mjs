// Actual IDB transaction abort and stale Writer retry, using unmodified release exports.
import { cacheClient } from './engine-cache-client.mjs';
import { fakeRelay } from './browser-relay.mjs';
export async function cacheStorage({ browser, origin, sign, pubkey, note, follows, relays, check, report, supported }) {
  const labels = [
    'a failed metadata transaction rolls back event and checkpoint bodies together',
    'another Worker commits its newer metadata while the older batch is blocked',
    'the stale Worker retry cannot replace the newer committed author metadata',
  ];
  if (!supported) {
    for (const label of labels) check(label, false);
    return { supported: false };
  }
  let context, client;
  const result = { supported: true, cleanup: {} };
  try {
    const metadata = async at => sign({ pubkey, kind: 0, created_at: at, tags: [],
      content: JSON.stringify({ name: 'cache-fixture', picture: 'https://cache-fixture.invalid/picture.png' }) });
    const old = await metadata(1700000002), newest = await metadata(1700000003);
    for (const [path, profile] of [['/cache-old', old], ['/cache-new', newest]]) {
      const relay = fakeRelay();
      for (const event of [profile, follows, note]) relay.add(event);
      relays.set(path, relay);
    }
    context = await browser.newContext();
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      report.externalRequests++; return route.abort();
    });
    context.on('page', page => page.on('pageerror', () => report.pageErrors++));
    client = await cacheClient(context, origin, pubkey, note.id);
    await client.call('boot', 'older', false, { relayPath: '/cache-old', abortMetadata: true });
    result.older = await client.call('observe', 'older', 10_000);
    if (!result.older.hasName) throw Error('blocked Writer did not receive the control profile');
    result.aborts = await client.call('waitAbort', 'older');
    result.afterAbort = await client.call('inspect', [old.id, note.id, follows.id]);
    check(labels[0], result.afterAbort.existingIds.length === 0 && result.afterAbort.metadataIds.length === 0);
    await client.call('boot', 'newer', false, { relayPath: '/cache-new' });
    result.newer = await client.call('observe', 'newer', 10_000);
    result.newSaved = await client.call('waitSaved', [newest.id, note.id, follows.id]);
    result.afterNew = await client.call('inspect', [old.id, newest.id]);
    check(labels[1], result.newer.hasName && result.newSaved.receipts &&
      result.afterNew.metadataIds.includes(newest.id) && !result.afterNew.metadataIds.includes(old.id));
    await client.call('allow', 'older');
    result.oldSaved = await client.call('waitSaved', [old.id]);
    result.afterRetry = await client.call('inspect', [old.id, newest.id]);
    check(labels[2], result.oldSaved.receipts && result.afterRetry.existingIds.length === 2 &&
      result.afterRetry.metadataIds.includes(newest.id) && !result.afterRetry.metadataIds.includes(old.id) &&
      result.older.workerErrors === 0 && result.newer.workerErrors === 0);
    return result;
  } finally {
    try { await client?.close(); result.cleanup.workers = true; }
    finally {
      await context?.close(); result.cleanup.context = true;
      relays.delete('/cache-old'); relays.delete('/cache-new');
    }
  }
}
