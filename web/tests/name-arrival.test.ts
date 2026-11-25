// A name drawn before its profile came is quiet; the name that replaces it settles in once, in every tile drawing it
// in that moment, and a later redraw draws it plainly.
import { expect, it } from 'vitest';
import type { Author } from '../src/engine/protocol.ts';
import { nameState, SETTLE_MS } from '../src/views/name-arrival.ts';
import { nameButton } from '../src/views/parts.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const env = {} as ViewEnv;
const bare = (key: string): Author => ({ pubkey: key, npub: `npub1${'q'.repeat(58)}`, name: '' });

it('a short npub is pending, the arriving name settles in, then draws plainly', () => {
  const key = 'b'.repeat(64);
  const pending = nameButton(bare(key), env);
  expect(pending.classList.contains('pending')).toBe(true);
  expect(pending.textContent).toBe('npub1qqqqq…qqqq');
  const named = nameButton({ ...bare(key), name: 'Sam' }, env);
  expect(named.className).toBe('name arrived');
  expect(nameButton({ ...bare(key), name: 'Sam' }, env, 'name quiet').className).toBe(
    'name quiet arrived',
  );
});

it('a name known from the start never animates, and arrival expires', () => {
  expect(nameState('c'.repeat(64), false, 1000)).toBe('');
  const key = 'd'.repeat(64);
  expect(nameState(key, true, 1000)).toBe('pending');
  expect(nameState(key, false, 2000)).toBe('arrived');
  expect(nameState(key, false, 2000 + SETTLE_MS)).toBe('arrived');
  expect(nameState(key, false, 2001 + SETTLE_MS)).toBe('');
});

it('a raw key in the name field is still pending', () => {
  const key = 'e'.repeat(64);
  expect(nameButton({ ...bare(key), name: key }, env).classList.contains('pending')).toBe(true);
});
