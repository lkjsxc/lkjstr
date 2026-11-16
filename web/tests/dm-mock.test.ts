import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { MOCK_PASSWORD, mockEncrypted } from '../src/engine/mock/vault.ts';
import type { Action, FromEngine } from '../src/engine/protocol.ts';

describe('private mock contract', () => {
  let engine: MockEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    vi.useRealTimers();
  });
  it('requires advertised inboxes and preserves private unread state across locking', async () => {
    vi.useFakeTimers();
    const messages: FromEngine[] = [];
    engine = createMockEngine(
      (m) => messages.push(m),
      () => 1700000000000,
    );
    let serial = 0;
    const act = (action: Action) => {
      const req = `private-${++serial}`;
      engine?.handle({ t: 'act', req, action });
      return messages.find(
        (m): m is Extract<FromEngine, { t: 'result' }> => m.t === 'result' && m.req === req,
      );
    };
    const a = '1a'.repeat(32),
      b = '2b'.repeat(32);
    for (const pubkey of [a, b])
      expect(
        act({ a: 'account.importEncrypted', key: mockEncrypted(pubkey), password: MOCK_PASSWORD })
          ?.ok,
      ).toBe(true);
    const send: Action = {
      a: 'dm.send',
      as: a,
      draft: { recipients: [b], text: 'private fixture' },
    };
    expect(act(send)?.error?.code).toBe('not-found');
    for (const as of [a, b])
      expect(act({ a: 'dm.relays.save', as, relays: ['wss://mock-inbox.invalid'] })?.ok).toBe(true);
    engine.handle({ t: 'dm.open', sub: 'private', query: { account: b } });
    expect(act(send)?.ok).toBe(true);
    const last = () =>
      messages
        .filter((m): m is Extract<FromEngine, { t: 'dm' }> => m.t === 'dm' && m.sub === 'private')
        .at(-1)?.snapshot;
    const conversation = last()?.conversations[0];
    expect(conversation?.unread).toBe(1);
    expect(act({ a: 'dm.seen', as: b, conversation: conversation?.key ?? '' })?.ok).toBe(true);
    expect(last()?.conversations[0]?.unread).toBe(0);
    expect(act({ a: 'account.lock', pubkey: b })?.ok).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(last()).toMatchObject({
      phase: 'failed',
      error: 'signer-missing',
      conversations: [],
      messages: [],
    });
    expect(act({ a: 'account.unlock', pubkey: b, password: MOCK_PASSWORD })?.ok).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(last()?.conversations[0]?.unread).toBe(0);
    expect(last()?.conversations[0]?.last.text).toBe('private fixture');
    expect(messages.some((m) => m.t === 'patch')).toBe(false);
  });
});
