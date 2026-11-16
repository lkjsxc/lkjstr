// Force cross-Worker overlap by holding only the owned fixture signer's seed response.
import { archiveDisk } from './engine-draft-client.mjs';
export async function draftRaces({client, page, note, check}) {
  const account = note.pubkey;
  const draft = text => ({draft:{recipients:[], text}, failed:[]});
  const save = (tab, text) => ({a:'dm.draft.save', as:account, tab, state:draft(text)});
  const load = tab => ({a:'dm.draft.load', as:account, tab});
  // Each fresh Worker must unwrap the same committed archive before it can write.
  await client.start('other');
  const paused = await client.hold('other', save('parallel-tab', 'parallel retained text'));
  check('archive competing unrelated tab commits',
    (await client.act('main', save('main-tab', 'main retained text'))).ok);
  await client.answer('other', paused.crypt);
  check('archive ciphertext CAS merges unrelated tabs', (await client.finish('other', paused.req)).ok);
  check('archive merged tabs both survive', (await client.act('main', load('parallel-tab'))).dmDraft?.draft.text === 'parallel retained text'
    && (await client.act('main', load('main-tab'))).dmDraft?.draft.text === 'main retained text');
  await client.start('other');
  const conflict = await client.hold('other', save('main-tab', 'local pending conflict'));
  check('archive same-tab competing writer commits',
    (await client.act('main', save('main-tab', 'remote retained edit'))).ok);
  await client.answer('other', conflict.crypt);
  check('archive same-tab conflict never silently replaces a draft',
    (await client.finish('other', conflict.req)).error?.code === 'rejected'
    && (await client.act('main', load('main-tab'))).dmDraft?.draft.text === 'remote retained edit');

  const loaded = await client.act('main', load('main-tab'));
  const newer = await client.act('other', {...save('main-tab', 'separate newer revision'), expected:loaded.dmDraftRevision});
  check('archive save returns the committed revision', newer.ok
    && /^[a-f0-9]{64}$/.test(newer.dmDraftRevision) && newer.dmDraftRevision !== loaded.dmDraftRevision);
  const stale = await client.act('main', {...save('main-tab', 'stale editor text'), expected:loaded.dmDraftRevision});
  check('archive an older editor cannot overwrite a separately committed newer state',
    stale.error?.code === 'rejected'
    && (await client.act('main', load('main-tab'))).dmDraft?.draft.text === 'separate newer revision');
  const absent = await client.act('main', load('absent-version'));
  // Remove/re-add in the other Worker invalidates an old first-save generation.
  check('archive fixture removal commits', (await client.act('main', {a:'account.remove', pubkey:account})).ok);
  check('archive fixture re-add commits', (await client.act('main', {a:'account.add', how:'extension', key:account})).ok);
  await client.start('other');
  const first = await client.hold('main', save('first-save-race', 'must never resurrect'));
  const before = await archiveDisk(page, [account], ['must never resurrect']);
  check('archive other Worker removes the account', (await client.act('other', {a:'account.remove', pubkey:account})).ok);
  check('archive other Worker re-adds the same account', (await client.act('other', {a:'account.add', how:'extension', key:account})).ok);
  await client.answer('main', first.crypt);
  check('archive removal generation rejects stale first-save completion',
    (await client.finish('main', first.req)).error?.code === 'rejected');
  const after = await archiveDisk(page, [account], ['must never resurrect']);
  check('archive stale first-save cannot recreate storage after remove/re-add',
    after.archives[0] === null && before.generation !== after.generation && after.privateTextAbsent);
  const results = (await client.messages('main')).filter(m => m.t === 'result' && m.req === first.req);
  check('archive stale first-save settles once', results.length === 1);

  await client.start('main');
  const cryptCount = (await client.messages('main')).filter(m => m.t === 'crypt').length;
  const oldAbsent = await client.act('main', {...save('absent-version', 'must not restore old absence'), expected:absent.dmDraftRevision});
  check('archive absent revisions also reject remove/re-add before signer work',
    oldAbsent.error?.code === 'rejected'
    && (await client.messages('main')).filter(m => m.t === 'crypt').length === cryptCount);
  const revoked = await client.hold('main', save('revoked', 'revoked draft text'));
  check('archive same-Worker removal commits during signer wait',
    (await client.act('main', {a:'account.remove', pubkey:account})).ok);
  await client.answer('main', revoked.crypt);
  const result = await client.finish('main', revoked.req, false);
  await client.barrier('main');
  check('archive signer completion cannot revive removed Host plaintext',
    result.ok === false && result.error?.code === 'signed-out');
  check('archive revoked operation settles once',
    (await client.messages('main')).filter(m => m.t === 'result' && m.req === revoked.req).length === 1);
}
