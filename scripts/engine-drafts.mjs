// The real archive suite owns a fresh context and uses only loopback fixture signers.
import { validateReplies } from './engine-contract.mjs';
import { archiveDisk, draftClients } from './engine-draft-client.mjs';
import { draftRaces } from './engine-draft-races.mjs';
export async function privateDrafts({page:ownerPage, origin, note, signer, lines, bunker, check, kinds, fake}) {
  const context = await ownerPage.context().browser().newContext();
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage();
  try {
    await page.goto(origin);
    const client = await draftClients({page, origin, note, signer, lines, kinds});
    await client.start('main');
    const act = action => client.act('main', action);
    check('archive creates only a fresh test account', (await act({a:'account.add', how:'create'})).ok);
    const local = (await client.messages('main')).filter(m => m.t === 'accounts').at(-1).active;
    const exported = await act({a:'account.exportEncrypted', pubkey:local, password:'archive fixture', logN:16});
    check('archive fixture key backup is encrypted', exported.ok && Boolean(exported.encryptedKey));
    check('archive fixture uses protected local storage',
      (await act({a:'account.importEncrypted', key:exported.encryptedKey, password:'archive fixture'})).ok);
    check('archive extension fixture selects its public key',
      (await act({a:'account.add', how:'extension', key:note.pubkey})).ok);
    check('archive bunker fixture connects only to loopback',
      (await act({a:'account.add', how:'key', key:'bunker://' + bunker.pubkey + '?relay='
        + encodeURIComponent(origin.replace('http:', 'ws:') + '/bunker')})).ok);
    const accounts = [local, note.pubkey, bunker.pubkey], markers = [];
    const published = fake.published.length;
    for (const [index, account] of accounts.entries()) {
      const text = 'private archive marker ' + index, failed = 'private failure marker ' + index;
      markers.push(text, failed, 'outside failure detail');
      const absent = await act({a:'dm.draft.load', as:account, tab:'same-tab'});
      check('archive absent slot is explicit ' + index, absent.ok && absent.dmDraft === undefined
        && /^[a-f0-9]{64}$/.test(absent.dmDraftRevision));
      const state = {draft:{recipients:[note.pubkey], text}, failed:[
        {key:'failed-row', draft:{recipients:[note.pubkey], text:failed},
          error:{code:'rejected', message:'outside failure detail'}, dmDelivery:{accepted:1, total:2}},
      ]};
      check('archive commits encrypted state for signer ' + index,
        (await act({a:'dm.draft.save', as:account, tab:'same-tab', state})).ok);
      const loaded = await act({a:'dm.draft.load', as:account, tab:'same-tab'});
      check('archive restores account-isolated state for signer ' + index,
        loaded.ok && loaded.dmDraft?.draft.text === text
        && loaded.dmDraft.failed[0].draft.text === failed
        && loaded.dmDraft.failed[0].error.message === undefined);
    }
    const disk = await archiveDisk(page, accounts, markers);
    check('archive never places plaintext in public storage', disk.privateTextAbsent);
    check('archive persists only the bounded encrypted envelope', disk.archives.every(a =>
      a?.keys.join(',') === 'cipherCatalog,version,wrappedSeed' && a.segments > 0));
    check('archive save/load never publishes or automatically resends', fake.published.length === published);
    check('archive local lock commits', (await act({a:'account.lock', pubkey:local})).ok);
    check('archive locked local account cannot retrieve plaintext',
      (await act({a:'dm.draft.load', as:local, tab:'same-tab'})).error?.code === 'signer-missing');
    check('archive local unlock commits',
      (await act({a:'account.unlock', pubkey:local, password:'archive fixture'})).ok);
    check('archive unlock reopens committed ciphertext',
      (await act({a:'dm.draft.load', as:local, tab:'same-tab'})).dmDraft?.draft.text === markers[0]);

    await client.start('main');
    check('archive restart keeps the local key locked',
      (await act({a:'dm.draft.load', as:local, tab:'same-tab'})).error?.code === 'signer-missing');
    check('archive restarted local account unlocks',
      (await act({a:'account.unlock', pubkey:local, password:'archive fixture'})).ok);
    for (const [index, account] of accounts.entries()) {
      const loaded = await act({a:'dm.draft.load', as:account, tab:'same-tab'});
      check('archive ciphertext survives real Worker restart for signer ' + index,
        loaded.ok && loaded.dmDraft?.draft.text === 'private archive marker ' + index
        && loaded.dmDraft.failed.length === 1);
    }
    check('archive per-tab clear commits',
      (await act({a:'dm.draft.clear', as:local, tab:'same-tab'})).ok);
    const cleared = await act({a:'dm.draft.load', as:local, tab:'same-tab'});
    check('archive per-tab clear returns absence', cleared.ok && cleared.dmDraft === undefined);
    check('archive clearing one account preserves another',
      (await act({a:'dm.draft.load', as:note.pubkey, tab:'same-tab'})).dmDraft?.draft.text === 'private archive marker 1');
    await draftRaces({client, page, note, check});
    for (const account of [local, bunker.pubkey]) {
      check('archive owned fixture account removal commits ' + account.slice(0, 8),
        (await client.act('main', {a:'account.remove', pubkey:account})).ok);
    }
    const removed = await archiveDisk(page, accounts, markers);
    check('archive account removal deletes all its encrypted records', removed.archives.every(a => a === null));
    for (const name of ['main', 'other']) validateReplies(await client.messages(name));
  } finally {
    await context.close();
  }
}
