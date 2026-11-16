import { expect, it } from 'vitest';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import type { FromEngine } from '../src/engine/protocol.ts';
import { feedState } from '../src/views/feed-state.ts';

it('mock exposes explicit ready fixture state and account-scoped retry failures', () => {
  const out: FromEngine[] = [],
    engine = createMockEngine((m) => out.push(m));
  try {
    engine.handle({
      t: 'configure',
      config: { language: 'en', heuristics: true, prefetch: false, mock: { live: false } },
    });
    const account = out.filter((m) => m.t === 'accounts').at(-1)?.accounts[0];
    expect(account?.privateLists).toEqual({ phase: 'ready', pending: 0, failed: 0 });
    engine.handle({
      t: 'open',
      sub: 'private',
      visible: false,
      query: { source: 'mutes', account: account?.author.pubkey, privateLists: true },
    });
    const state = out.filter((m) => m.t === 'state').at(-1)?.state;
    expect(state?.privateLists).toEqual({ phase: 'ready', pending: 0, failed: 0 });
    engine.handle({ t: 'act', req: 'bad', action: { a: 'lists.retry', as: '0'.repeat(64) } });
    expect(out).toContainEqual({
      t: 'result',
      req: 'bad',
      ok: false,
      error: { code: 'signed-out' },
    });
    engine.handle({
      t: 'act',
      req: 'good',
      action: { a: 'lists.retry', as: account?.author.pubkey ?? '' },
    });
    expect(out).toContainEqual({ t: 'result', req: 'good', ok: true });
  } finally {
    engine.dispose();
  }
});
it('existing feed state never calls a pending or failed private dependency an empty result', () => {
  const base = { phase: 'done', relaysAsked: 1, relaysAnswered: 1 } as const;
  expect(
    feedState(
      [],
      { ...base, privateLists: { phase: 'loading', pending: 1, failed: 0 } },
      true,
      false,
    ).key,
  ).toBe('feed.loading');
  expect(
    feedState(
      [],
      {
        ...base,
        privateLists: { phase: 'failed', pending: 0, failed: 1, error: 'signer-refused' },
      },
      true,
      false,
    ).key,
  ).toBe('feed.failed');
  expect(
    feedState([], { ...base, privateLists: { phase: 'ready', pending: 0, failed: 0 } }, true, false)
      .key,
  ).toBe('feed.empty');
});
