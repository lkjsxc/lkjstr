// Archive-specific checks run only on the package that includes draft operations.
import { archiveDisk } from './engine-draft-client.mjs';
export async function archiveSignerCases({make, fixtures, check}) {
  for (const recipient of ['extension','bunker']) {
    const client = await make(recipient);
    try {
      const state = {draft:{recipients:[],text:'archive refusal private marker'},failed:[]};
      const initial = (await client.crypts()).length;
      fixtures.mode({error:'unsupported'});
      const req = await client.begin({a:'dm.draft.save', as:client.account, tab:'archive', state});
      if (recipient === 'extension') {
        await client.until(all => all.some(m => m.t === 'crypt'));
        await client.answer((await client.crypts()).at(-1), 'unsupported');
      }
      check('archive seed refusal is reported for ' + recipient, (await client.finish(req)).error?.code === 'unsupported');
      const count = recipient === 'extension' ? (await client.crypts()).length : fixtures.calls.length;
      const again = await client.act({a:'dm.draft.save', as:client.account, tab:'archive', state});
      check('archive seed refusal pauses further prompts for ' + recipient, again.error?.code === 'unsupported'
        && (recipient === 'extension' ? (await client.crypts()).length : fixtures.calls.length) === count);
      check('archive refused state never reaches durable plaintext for ' + recipient,
        (await archiveDisk(client.page, [client.account], [state.draft.text])).privateTextAbsent);
      if (recipient === 'extension') check('archive refusal asks once', count - initial === 1);
    } finally { await client.close(); fixtures.mode({}); }
  }
  const client = await make('extension');
  try {
    const state = {draft:{recipients:[],text:'archive replaced private marker'},failed:[]};
    const req = await client.begin({a:'dm.draft.save', as:client.account, tab:'archive', state});
    await client.until(all => all.some(m => m.t === 'crypt'));
    const old = (await client.crypts()).at(-1);
    const replacement = await client.begin({a:'account.add', how:'extension', key:client.account});
    check('archive replacement account commits', (await client.finish(replacement)).ok);
    const cancelled = await client.finish(req), all = await client.messages();
    check('same-pubkey replacement revokes old archive before account acknowledgement',
      !cancelled.ok && cancelled.error?.code === 'signer-missing'
      && all.findIndex(m => m.t === 'result' && m.req === req)
        < all.findIndex(m => m.t === 'result' && m.req === replacement));
    await client.answer(old); await client.barrier();
    const loaded = await client.act({a:'dm.draft.load', as:client.account, tab:'archive'});
    check('late replaced signer cannot commit old archive seed/plaintext', loaded.ok && loaded.dmDraft === undefined);
    const disk = await archiveDisk(client.page, [client.account], [state.draft.text]);
    check('replacement leaves no archive or plaintext from cancelled first save', disk.privateTextAbsent && disk.archives[0] === null);
  } finally { await client.close(); }
}
