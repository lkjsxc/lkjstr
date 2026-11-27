import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import { SECOND } from '../src/engine/mock/people.ts';
import type { FromEngine } from '../src/engine/protocol.ts';
import { assertOwnership, fixtureNow, rows } from './signer-ownership-fixture.ts';

const pubkey = SECOND.author.pubkey;
let out: FromEngine[];
let mock: ReturnType<typeof createMockEngine>;
beforeEach(() => {
  vi.useFakeTimers();
  out = [];
  mock = createMockEngine(
    (m) => out.push(m),
    () => fixtureNow,
    { signerOwnership: true },
  );
  mock.handle({
    t: 'configure',
    config: {
      language: 'en',
      heuristics: true,
      prefetch: false,
      mock: { live: false, slow: { when: 'fixture', sign: 100 } },
    },
  });
  mock.handle({ t: 'act', req: 'select', action: { a: 'account.use', pubkey } });
});
afterEach(() => {
  mock.dispose();
  vi.useRealTimers();
});
function last<T extends 'sign' | 'getPublicKey' | 'crypt' | 'sign.cancel' | 'crypt.cancel'>(
  t: T,
): Extract<FromEngine, { t: T }> {
  const message = out.findLast((m) => m.t === t);
  if (!message || message.t !== t) throw new Error(`mock did not emit ${t}`);
  return message as Extract<FromEngine, { t: T }>;
}

it('real mock actions emit the same note and discovery ownership as the Worker', () => {
  mock.handle({ t: 'act', req: 'discover', action: { a: 'account.add', how: 'extension' } });
  assertOwnership('discovery', last('getPublicKey'));
  mock.handle({ t: 'publicKey', req: 'discover', pubkey });
  expect(out).toContainEqual({ t: 'result', req: 'discover', ok: true });
  mock.handle({
    t: 'act',
    req: 'publish',
    action: { a: 'publish', as: pubkey, what: { k: 'note', draft: { text: 'fixture' } } },
  });
  assertOwnership('core-publish', last('sign'));
});

it('mock DM actions emit authorized silent signing and settle only the correlated signature', () => {
  const relays = ['wss://fixture.invalid'];
  mock.handle({
    t: 'act',
    req: 'dm-advertisement',
    action: { a: 'dm.relays.save', as: pubkey, relays },
  });
  const advertisement = last('sign');
  assertOwnership('dm-advertisement', advertisement, { req: advertisement.req });
  expect(out.some((m) => m.t === 'result' && m.req === 'dm-advertisement')).toBe(false);
  mock.handle({ t: 'signed', req: 'dm-advertisement', event: '{}' });
  expect(out.some((m) => m.t === 'result' && m.req === 'dm-advertisement')).toBe(false);
  mock.handle({ t: 'signed', req: advertisement.req, event: '{}' });
  expect(out).toContainEqual({ t: 'result', req: 'dm-advertisement', ok: true });

  mock.handle({
    t: 'act',
    req: 'dm-send',
    action: { a: 'dm.send', as: pubkey, draft: { text: 'fixture', recipients: [pubkey] } },
  });
  const seal = last('sign');
  assertOwnership('dm-seal', seal, { req: seal.req });
  expect(seal.req).not.toBe(advertisement.req);
  expect(out.some((m) => m.t === 'result' && m.req === 'dm-send')).toBe(false);
  mock.handle({ t: 'signed', req: advertisement.req, event: '{}' });
  expect(out.some((m) => m.t === 'result' && m.req === 'dm-send')).toBe(false);
  mock.handle({ t: 'signed', req: seal.req, event: '{}' });
  expect(out.find((m) => m.t === 'result' && m.req === 'dm-send')).toMatchObject({ ok: true });
});

it('the mock signer fixture emitter preserves direct correlation, absent ownership and retirement', () => {
  const bridge = mock.signerFixtures;
  bridge.coreAction('profile', pubkey);
  assertOwnership('core-action', last('sign'));
  for (const scenario of [
    'upload',
    'upload-nip98',
    'zap',
    'auth-visible',
    'auth-background',
    'auth-write',
    'dm-advertisement',
    'dm-seal',
  ] as const) {
    const req = bridge.sign(scenario, pubkey, rows[scenario].action);
    const message = last('sign');
    assertOwnership(scenario, message, { req });
    // The historical DM mock incorrectly used the originating action as its page owner.
    if (scenario === 'dm-seal') {
      expect(() =>
        assertOwnership(scenario, { ...message, actionReq: 'dm-send' }, { req }),
      ).toThrow('signer ownership: dm-seal');
    }
    bridge.cancel(req);
    if (scenario === 'upload' || scenario === 'dm-seal')
      assertOwnership(
        scenario === 'upload' ? 'upload-cancel' : 'dm-seal-cancel',
        last('sign.cancel'),
        { req },
      );
  }
  for (const scenario of ['dm-encrypt', 'dm-visible', 'dm-background', 'private-list'] as const) {
    const req = bridge.crypt(
      scenario,
      pubkey,
      scenario === 'private-list' ? pubkey : '22'.repeat(32),
      scenario === 'private-list' ? { sub: 'm', event: '33'.repeat(32) } : undefined,
    );
    const message = last('crypt');
    assertOwnership(scenario, message, { req });
    bridge.cancel(req);
    if (scenario === 'private-list' || scenario === 'dm-visible')
      assertOwnership(
        scenario === 'private-list' ? 'private-list-cancel' : 'dm-read-cancel',
        last('crypt.cancel'),
        { req },
      );
  }
});

it('shared exact comparison refuses missing, extra and altered ownership keys', () => {
  const bridge = mock.signerFixtures;
  const req = bridge.sign('upload', pubkey, 'upload');
  const message = last('sign');
  if (message.t !== 'sign') throw new Error('sign');
  const { actionReq: _owner, ...missing } = message;
  expect(() => assertOwnership('upload', missing, { req })).toThrow('signer ownership: upload');
  expect(() => assertOwnership('upload', { ...message, actionReq: 'another' }, { req })).toThrow(
    'signer ownership: upload',
  );
  expect(() => assertOwnership('upload', { ...message, weight: 2 }, { req })).toThrow(
    'signer ownership: upload',
  );
  const cryptReq = bridge.crypt('dm-background', pubkey, '22'.repeat(32));
  const crypt = last('crypt');
  if (crypt.t !== 'crypt') throw new Error('crypt');
  const { background: _background, ...foreground } = crypt;
  expect(() => assertOwnership('dm-background', foreground, { req: cryptReq })).toThrow(
    'signer ownership: dm-background',
  );
});
