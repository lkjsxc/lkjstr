// The same cached ciphertext cases run against an immutable old and a current real Worker.
const privateCalls = fixtures => fixtures.calls.filter(call => /^(nip44|nip04)_/.test(call.method ?? ''));
export async function receiveSignerCases({make, fixtures, check, before, evidence}) {
  async function retryFresh(client, old) {
    await client.open();
    try {
      await client.until(all => all.some(m => m.t === 'crypt' && m.pubkey === client.account
        && !old.some(request => request.req === m.req)), 2500);
      return true;
    } catch { return false; }
  }
  for (const error of ['signer-refused', 'unsupported']) {
    const client = await make('extension');
    try {
      await client.open(); await client.until(all => all.some(m => m.t === 'crypt'));
      await client.barrier();
      const initial = await client.crypts();
      check('extension starts one cached-envelope call ' + error, initial.length === 1, initial.length);
      await client.answer(initial[0], error);
      await client.until(all => all.some(m => m.t === 'dm' && ['failed','unsupported'].includes(m.snapshot.phase)));
      check('extension preserves private error ' + error, (await client.snapshot())?.error === error, (await client.snapshot())?.error);
      await client.page.waitForTimeout(250);
      check('extension stops queued prompts on first ' + error, (await client.crypts()).length === 1);
      const fresh = await retryFresh(client, initial);
      check('extension Retry starts a new call after ' + error, fresh);
      if (fresh) {
        await client.answer(initial.at(-1), 'unsupported');
        await client.barrier(); await client.page.waitForTimeout(500);
        check('old extension reply cannot relatch Retry ' + error, !(await client.snapshot())?.error);
      }
    } finally { await client.close(); }
  }
  for (const operation of ['hide', 'replace']) {
    const client = await make('extension');
    try {
      await client.open(); await client.until(all => all.some(m => m.t === 'crypt')); await client.barrier();
      const old = await client.crypts();
      old.forEach(client.ignore);
      if (operation === 'hide') {
        await client.send({t:'dm.visible', sub:'private', visible:false}); await client.barrier();
        await client.send({t:'dm.visible', sub:'private', visible:true});
      } else await client.must({a:'account.add', how:'extension', key:client.account});
      let fresh = false;
      try { await client.until(all => all.some(m => m.t === 'crypt' && !old.some(r => r.req === m.req)), 2500); fresh = true; } catch {}
      check('extension ' + operation + ' releases never-answering call', fresh);
      await client.answer(old.at(-1), 'unsupported'); await client.barrier(); await client.page.waitForTimeout(500);
      check('extension ' + operation + ' ignores old authority reply', (await client.snapshot())?.error !== 'unsupported');
      if (fresh && !before) { await client.decryptAll(); check('extension ' + operation + ' decrypts both cached messages', true); }
    } finally { await client.close(); }
  }
  for (const error of ['signer-refused', 'unsupported']) {
    fixtures.mode({error});
    const client = await make('bunker', false);
    try {
      const start = privateCalls(fixtures).length;
      await client.open();
      await client.until(all => all.some(m => m.t === 'dm' && ['failed','unsupported'].includes(m.snapshot.phase)));
      await client.page.waitForTimeout(500);
      const count = privateCalls(fixtures).length - start;
      check('bunker stops after first ' + error, count === 1, count);
      check('bunker preserves private error ' + error, (await client.snapshot())?.error === error);
    } finally { await client.close(); fixtures.mode({}); await fixtures.release(); }
  }
  for (const operation of ['hide', 'replace']) {
    fixtures.mode({hold:true});
    const client = await make('bunker', false);
    try {
      await client.open();
      await client.until(() => fixtures.held() > 0); await client.barrier(); await client.page.waitForTimeout(150);
      const old = fixtures.heldIds(), start = privateCalls(fixtures).length;
      if (operation === 'hide') {
        await client.send({t:'dm.visible', sub:'private', visible:false}); await client.barrier();
        await client.page.waitForTimeout(150);
        check('bunker hiding closes owned old RPC sockets', fixtures.openHeld(old) === 0);
        await client.send({t:'dm.visible', sub:'private', visible:true});
      } else await client.must({a:'account.add', how:'key', key:'bunker://' + fixtures.pubkey
          + '?relay=' + encodeURIComponent(client.relay + '/bunker')});
      let fresh = false;
      try { await client.until(() => privateCalls(fixtures).length > start, 2500); fresh = true; } catch {}
      check('bunker ' + operation + ' releases never-answering call', fresh);
      await fixtures.release('unsupported', old);
      await client.barrier(); await client.page.waitForTimeout(500);
      check('bunker ' + operation + ' ignores old authority reply', (await client.snapshot())?.error !== 'unsupported'
        && (await client.snapshot())?.error !== 'signer-refused');
      fixtures.mode({}); await fixtures.release();
      if (fresh && !before) {
        await client.until(all => all.some(m => m.t === 'dm' && m.snapshot.conversations.some(c => c.unread >= 2)));
        check('bunker ' + operation + ' decrypts both cached messages', true);
      }
    } finally { await client.close(); fixtures.mode({}); await fixtures.release(); }
  }
  const local = await make('local');
  try {
    await local.open();
    await local.until(all => all.some(m => m.t === 'dm' && m.snapshot.conversations.some(c => c.unread >= 2)));
    check('local signer decrypts both cached messages without external crypto', (await local.crypts()).length === 0);
  } finally { await local.close(); }
  evidence.beforeOnlyOmissions = before ? ['archive operations absent from protocol7', 'actual 60-second timeout measured after only'] : [];
}
export async function signerTimeoutCases({make, fixtures, check, evidence}) {
  const extension = await make('extension');
  fixtures.mode({hold:true});
  const bunker = await make('bunker', false, false);
  try {
    await extension.open(); await bunker.open();
    await extension.until(all => all.some(m => m.t === 'crypt'));
    await bunker.until(() => fixtures.held() > 0);
    const oldExtension = await extension.crypts(), oldBunker = fixtures.heldIds();
    oldExtension.forEach(extension.ignore);
    const started = Date.now();
    await Promise.all([extension, bunker].map(client => client.until(all =>
      all.some(m => m.t === 'dm' && m.snapshot.error === 'signer-timeout'), 75_000)));
    evidence.actualTimeoutWaitMs = Date.now() - started;
    check('extension actual signer deadline is distinct', (await extension.snapshot())?.error === 'signer-timeout');
    check('bunker actual signer deadline is distinct', (await bunker.snapshot())?.error === 'signer-timeout');
    check('bunker timeout closes old RPC sockets', fixtures.openHeld(oldBunker) === 0);
    fixtures.mode({});
    await extension.open(); await bunker.open();
    await extension.until(all => all.some(m => m.t === 'crypt' && !oldExtension.some(r => r.req === m.req)));
    await extension.answer(oldExtension[0], 'unsupported');
    await fixtures.release('unsupported', oldBunker);
    await extension.decryptAll();
    await bunker.until(all => all.some(m => m.t === 'dm' && m.snapshot.conversations.some(c => c.unread >= 2)));
    check('Retry after real timeout recovers both signer kinds and ignores old replies', true);
  } finally { await extension.close(); await bunker.close(); fixtures.mode({}); await fixtures.release(); }
}
