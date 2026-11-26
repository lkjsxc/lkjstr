import { expect, it, vi } from 'vitest';
import type { AccountState } from '../src/engine/client.ts';
import { openIncomingLink } from '../src/shared/incoming-link.ts';
import { nostrLinkPath, pastedNostrLink } from '../src/shared/nostr-link.ts';
import { createSignal } from '../src/shared/signal.ts';
import { CHOICES } from '../src/wm/choices.ts';

it.each([
  ['note1qqqqqq', 'n'],
  ['nevent1qqqqqq', 'n'],
  ['naddr1qqqqqq', 'a'],
  ['npub1qqqqqq', 'p'],
  ['nprofile1qqqqqq', 'p'],
] as const)('finds the %s entity in bare, legacy and nostr URI paths', (ref, route) => {
  const link = { ref, route };
  expect(nostrLinkPath(`/${ref}`)).toEqual(link);
  expect(nostrLinkPath(`/${route}/${ref}/`)).toEqual(link);
  expect(nostrLinkPath(`/nostr%3A${ref}`)).toEqual(link);
  expect(pastedNostrLink(` nostr:${ref} `)).toEqual(link);
  expect(pastedNostrLink(ref)).toEqual(link);
});

it('offers direct launcher targets for pasted web addresses', () => {
  for (const [url, ref, kind] of [
    ['https://lkjstr.lkjsxc.com/nevent1qqqqqq', 'nevent1qqqqqq', 'thread'],
    ['https://njump.me/naddr1qqqqqq?source=share', 'naddr1qqqqqq', 'thread'],
    ['https://nostter.app/nprofile1qqqqqq/', 'nprofile1qqqqqq', 'profile'],
    ['https://primal.net/e/NEVENT1QQQQQQ#share', 'NEVENT1QQQQQQ', 'thread'],
  ] as const) {
    expect(CHOICES.typed(url)[0]).toMatchObject({ kind, state: { ref } });
  }
});

it.each([
  'https://lkjstr.lkjsxc.com/p/nevent1qqqqqq',
  'https://example.com/page?ref=note1qqqqqq',
  'https://example.com/note1qqqqqq/extra',
  'https://example.com/%xx',
  'https://example.com/note1qqqqqq%2F',
  'https://example.com/en/about.html',
  'nostr:nrelay1qqqqqq',
  'wss://example.com/note1qqqqqq',
])('does not treat %s as a public pointer', (text) => {
  expect(pastedNostrLink(text)).toBeUndefined();
});

it('waits for account boot before opening the incoming tab exactly once', async () => {
  const ref = 'nevent1qqqqqq';
  history.replaceState(null, '', `/${ref}?source=share`);
  const accountState = createSignal<AccountState>({ phase: 'loading' });
  const act = vi.fn(async () => ({ t: 'result' as const, req: 'test', ok: true }));
  const open = vi.fn();
  const report = vi.fn();
  const pending = openIncomingLink({ act, accountState }, open, report);
  await vi.waitFor(() => expect(act).toHaveBeenCalledWith({ a: 'link.check', route: 'n', ref }));
  expect(open).not.toHaveBeenCalled();
  expect(location.pathname).toBe(`/${ref}`);
  accountState.set({ phase: 'ready' });
  await pending;
  accountState.set({ phase: 'loading' });
  accountState.set({ phase: 'ready' });
  expect(open).toHaveBeenCalledExactlyOnceWith('thread', ref);
  expect(report).not.toHaveBeenCalled();
  expect(location.pathname + location.search).toBe('/');
});

it('passes the original identifier on prefixed routes to the Worker', async () => {
  history.replaceState(null, '', '/p/aoi');
  const act = vi.fn(async () => ({ t: 'result' as const, req: 'test', ok: true }));
  const open = vi.fn();
  await openIncomingLink({ act }, open, vi.fn());
  expect(act).toHaveBeenCalledExactlyOnceWith({ a: 'link.check', route: 'p', ref: 'aoi' });
  expect(open).toHaveBeenCalledExactlyOnceWith('profile', 'aoi');
});
