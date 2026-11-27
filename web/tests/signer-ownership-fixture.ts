// Shared by Vitest and the loopback Worker harness. Only payloads and nondeterministic
// identifiers/times are normalized; every other own wire key (including absence) is exact.
import assert from 'node:assert/strict';
import type { FromEngine } from '../src/engine/protocol.ts';
import native from './fixtures/native-signer-ownership.json' with { type: 'json' };

type SignerMessage = Extract<
  FromEngine,
  { t: 'sign' | 'getPublicKey' | 'crypt' | 'sign.cancel' | 'crypt.cancel' }
>;
type Row = { lifecycle: string; action?: string; message: SignerMessage };
type Scenario = keyof typeof native.rows;
export const fixtureNow = native.now;
export const rows = native.rows as unknown as Record<Scenario, Row>;
type RuntimeIds = { req?: string; actionReq?: string; contextEvent?: string; runtime?: boolean };

function projection(message: SignerMessage) {
  const wire = JSON.parse(JSON.stringify(message));
  if (wire.t === 'sign') {
    assert.equal(typeof wire.pubkey, 'string');
    assert.equal(typeof wire.event, 'string');
    const event = JSON.parse(wire.event);
    assert.equal(event.pubkey, wire.pubkey);
    delete wire.pubkey;
    delete wire.event;
    wire.eventKind = event.kind;
  } else if (wire.t === 'crypt') {
    for (const key of ['pubkey', 'peer', 'data']) {
      assert.equal(typeof wire[key], 'string');
      delete wire[key];
    }
  }
  return wire;
}

export function assertOwnership(
  scenario: Scenario,
  actual: SignerMessage,
  ids: RuntimeIds = {},
): void {
  const expected = projection(rows[scenario].message);
  const observed = projection(actual);
  // An independently known action ID must be supplied by the harness, not inferred from actionReq.
  if (ids.req !== undefined) {
    if (expected.req.startsWith('upload-auth-'))
      assert.match(ids.req, /^upload-auth-\d+-[0-9a-f]{32}$/, scenario);
    else if (expected.req.startsWith('dm-crypto-'))
      assert.match(ids.req, /^dm-crypto-[0-9a-f]{32}$/, scenario);
    expected.req = ids.req;
  }
  if (ids.actionReq !== undefined) {
    assert.notEqual(expected.req, ids.actionReq, scenario);
    assert.ok(Object.hasOwn(expected, 'actionReq'), scenario);
    expected.actionReq = ids.actionReq;
  }
  if (ids.contextEvent !== undefined) {
    assert.equal(expected.context.kind, 'private-list');
    assert.match(ids.contextEvent, /^[0-9a-f]{64}$/);
    expected.context.event = ids.contextEvent;
  }
  if (ids.runtime && Object.hasOwn(expected, 'expiresAt')) {
    assert.ok(Number.isSafeInteger(observed.expiresAt) && observed.expiresAt > 0, scenario);
    expected.expiresAt = observed.expiresAt;
  }
  assert.deepStrictEqual(observed, expected, `signer ownership: ${scenario}`);
  if (actual.t === 'crypt' && actual.context?.kind === 'private-list')
    assert.equal(actual.peer, actual.pubkey, scenario);
}
