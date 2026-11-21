import { afterEach, expect, it } from 'vitest';
import { mountCompose } from '../src/views/compose.ts';
import { personAddresses } from '../src/views/person-address.ts';
import { setup } from './wishes-support.ts';

const npub = `npub1${'q'.repeat(58)}`;
const nprofile = `nprofile1${'z'.repeat(70)}`;

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

it('finds only person addresses standing alone as a word, as the engine publishes them', () => {
  const text = [
    `(nostr:${npub}),`,
    `"${nprofile}"`,
    `<${npub.toUpperCase()}>!`,
    `https://x.example/${npub}`,
    `path/${npub}`,
    `x${npub}`,
    `Npub1${'q'.repeat(58)}`,
    `${npub}b`,
    `「${npub}」`,
  ].join(' ');
  expect(personAddresses(text).map((a) => [a.text, a.bech32])).toEqual([
    [`nostr:${npub}`, npub],
    [nprofile, nprofile],
    [npub.toUpperCase(), npub],
  ]);
});

it('asks the engine about a pasted address for its chip only when it stands alone', async () => {
  const x = setup();
  const off = mountCompose(x.el, x.env);
  const area = x.el.querySelector('textarea')!;
  const type = (text: string) => {
    area.value = text;
    area.setSelectionRange(text.length, text.length);
    area.dispatchEvent(new Event('input'));
  };
  const asked = () => x.requests.filter((r) => !r.closed && r.query.ref).map((r) => r.query.ref);
  type(`see https://x.example/${npub} there`);
  expect(asked()).toEqual([]);
  type(`see (nostr:${npub}).`);
  expect(asked()).toEqual([npub]);
  off();
});
