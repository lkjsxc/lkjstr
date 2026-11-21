import { expect, it, vi } from 'vitest';
import { draftText } from '../src/views/draft-row.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const npub = `npub1${'q'.repeat(58)}`;
const other = `npub1${'z'.repeat(58)}`;

it("draws a waiting draft's chosen people and standalone addresses as the published note's links", () => {
  const open = vi.fn();
  const env = { open } as unknown as ViewEnv;
  const upper = other.toUpperCase();
  const text = `@Lena Fischer hi (nostr:${npub}), see https://x.example/${other} and ${other}. "${upper}" Npub1${'q'.repeat(58)}`;
  const el = draftText(
    { text, mentions: [{ start: 0, end: 13, label: '@Lena Fischer', pubkey: 'a'.repeat(64) }] },
    env,
  );
  const links = [...el.querySelectorAll<HTMLButtonElement>('.lnk')];
  expect(links.map((b) => b.textContent)).toEqual(['@Lena Fischer', `nostr:${npub}`, other, upper]);
  expect(el.textContent).toBe(text);
  links[0]?.click();
  expect(open).toHaveBeenLastCalledWith(
    'profile',
    { pubkey: 'a'.repeat(64), title: 'Lena Fischer' },
    expect.anything(),
  );
  links[1]?.click();
  expect(open).toHaveBeenLastCalledWith('profile', { ref: npub }, expect.anything());
  links[3]?.click();
  expect(open).toHaveBeenLastCalledWith('profile', { ref: other }, expect.anything());
});

it('leaves a range whose text no longer matches its label as plain text', () => {
  const el = draftText(
    {
      text: '@Lena Fisher',
      mentions: [{ start: 0, end: 13, label: '@Lena Fischer', pubkey: 'a' }],
    },
    { open: vi.fn() } as unknown as ViewEnv,
  );
  expect(el.querySelectorAll('.lnk')).toHaveLength(0);
  expect(el.textContent).toBe('@Lena Fisher');
});
