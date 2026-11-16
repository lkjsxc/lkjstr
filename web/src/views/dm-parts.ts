// Shared presentation uses public author models; private message bodies never enter the public caches.
import type { Account, Author, DmSnapshot } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { hasKey, t } from '../shared/i18n.ts';
import { knownPerson } from '../shared/people.ts';
import { faceButton, how, plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export const dmError = (code: string): string => {
  if (code === 'signer-timeout') return t('dm.fail.timeout');
  const key = `error.${code}`;
  return t(hasKey(key) ? key : 'error.internal');
};
export const dmPeople = (snapshot: DmSnapshot | undefined, account: Account): Map<string, Author> =>
  new Map([account.author, ...(snapshot?.people ?? [])].map((author) => [author.pubkey, author]));
export const dmAuthor = (people: ReadonlyMap<string, Author>, pubkey: string): Author =>
  people.get(pubkey) ??
  knownPerson(pubkey) ?? { pubkey, npub: '', name: '', emoji: [], verified: false };
export const dmNames = (keys: readonly string[], people: ReadonlyMap<string, Author>): string =>
  keys.map((key) => plainName(dmAuthor(people, key))).join(t('list.sep'));
export const openMessage = (
  env: ViewEnv,
  participants: readonly string[],
  title: string,
  event?: MouseEvent,
): void => env.open('message', { participants, title }, event ? how(event) : undefined);
export function dmFaces(
  keys: readonly string[],
  people: ReadonlyMap<string, Author>,
  env: ViewEnv,
): HTMLElement {
  return h(
    'div',
    { class: keys.length > 1 ? 'dm-faces group' : 'dm-faces' },
    keys.slice(0, 2).map((key) => faceButton(dmAuthor(people, key), env)),
  );
}
export function inboxSetup(env: ViewEnv): HTMLElement {
  return h(
    'div',
    { class: 'dm-setup muted' },
    h('span', null, t('dm.setup')),
    h(
      'button',
      { class: 'btn', onclick: () => env.open('settings', { at: 'dmRelays', search: '' }) },
      t('dm.setup.go'),
    ),
  );
}
export function dmEnd(
  snapshot: DmSnapshot | undefined,
  count: number,
  older: boolean,
  retry: () => void,
  conversations = false,
): HTMLElement {
  const end = h('div', { class: 'fstate muted', role: 'status' });
  if (!snapshot || ((snapshot.phase === 'loading' || snapshot.phase === 'cache') && !count))
    end.append(t('dm.loading'));
  else if (snapshot.phase === 'failed')
    end.append(
      h('div', null, snapshot.error ? dmError(snapshot.error) : t('dm.failed')),
      h('button', { class: 'btn', onclick: retry }, t('dm.retry')),
    );
  else if (snapshot.phase === 'unsupported') {
    if (snapshot.error === 'unsupported') end.append(t('dm.signerOld'));
  } else if (!count) end.append(t(conversations ? 'dm.empty' : 'dm.first'));
  else if (older) end.append(t('dm.older'));
  else if (conversations && count >= 200) end.append(t('dm.capped'));
  else if (!snapshot.more) end.append(t('dm.end'));
  if (snapshot?.undecryptable)
    end.append(h('div', { class: 'faint' }, t('dm.undecryptable', { n: snapshot.undecryptable })));
  return end;
}
