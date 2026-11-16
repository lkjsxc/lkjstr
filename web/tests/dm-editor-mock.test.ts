import { afterEach, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { MOCK_PASSWORD, mockEncrypted } from '../src/engine/mock/vault.ts';
import type { FromEngine } from '../src/engine/protocol.ts';

let engine: MockEngine | undefined;
afterEach(() => {
  engine?.dispose();
  vi.useRealTimers();
});
it.each([true, false])('the mock lock waits for an explicit prepare acknowledgement (%s)', (ok) => {
  vi.useFakeTimers();
  const output: FromEngine[] = [],
    pubkey = 'a'.repeat(64);
  engine = createMockEngine((m) => output.push(m));
  engine.handle({
    t: 'act',
    req: 'import',
    action: { a: 'account.importEncrypted', key: mockEncrypted(pubkey), password: MOCK_PASSWORD },
  });
  engine.handle({
    t: 'act',
    req: 'editor',
    action: { a: 'dm.editor', as: pubkey, editor: 'owned', open: true, dirty: true },
  });
  engine.handle({ t: 'act', req: 'lock', action: { a: 'account.lock', pubkey } });
  const phases = output.filter(
    (m): m is Extract<FromEngine, { t: 'dm.flush' }> => m.t === 'dm.flush',
  );
  expect(phases.map((m) => m.phase)).toEqual(['hold', 'prepare']);
  expect(output.some((m) => m.t === 'result' && m.req === 'lock')).toBe(false);
  engine.handle({
    t: 'act',
    req: 'late-editor',
    action: { a: 'dm.editor', as: pubkey, editor: 'late', open: true },
  });
  expect(output.find((m) => m.t === 'result' && m.req === 'late-editor')).toMatchObject({
    ok: false,
  });
  engine.handle({ t: 'dm.flushed', req: 'wrong', ok: true });
  expect(output.some((m) => m.t === 'result' && m.req === 'lock')).toBe(false);
  if (ok)
    engine.handle({
      t: 'act',
      req: 'clean',
      action: { a: 'dm.editor', as: pubkey, editor: 'owned', open: true, dirty: false },
    });
  engine.handle({ t: 'dm.flushed', req: phases[0]?.req ?? '', ok });
  expect(output.find((m) => m.t === 'result' && m.req === 'lock')).toMatchObject({ ok });
  expect(output.at(-1)).toMatchObject({ t: 'dm.flush', phase: 'release' });
  const accounts = output
    .filter((m): m is Extract<FromEngine, { t: 'accounts' }> => m.t === 'accounts')
    .at(-1);
  expect(accounts?.accounts.find((a) => a.author.pubkey === pubkey)?.locked).toBe(ok);
  engine.handle({
    t: 'act',
    req: 'close',
    action: { a: 'dm.editor', as: pubkey, editor: 'owned', open: false },
  });
  expect(output.at(-1)).toMatchObject({ t: 'result', req: 'close', ok: true });
});
