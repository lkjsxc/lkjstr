// Opt-in harness controls for mock paths that normally project already-settled fixture data.
// These emit independently of the native golden; no real encryption or publication is claimed.
import type { FromEngine, ToEngine } from '../protocol.ts';
import type { Core } from './engine.ts';

type Sign =
  | 'upload'
  | 'upload-nip98'
  | 'zap'
  | 'auth-visible'
  | 'auth-background'
  | 'auth-write'
  | 'dm-advertisement'
  | 'dm-seal';
type Signed = Extract<ToEngine, { t: 'signed' }>;
type Crypt = 'dm-encrypt' | 'dm-visible' | 'dm-background' | 'private-list';
const signs: Record<Sign, { kind: number; weight: 2 | 4 | 8 }> = {
  upload: { kind: 24242, weight: 8 },
  'upload-nip98': { kind: 27235, weight: 8 },
  zap: { kind: 9734, weight: 8 },
  'auth-visible': { kind: 22242, weight: 4 },
  'auth-background': { kind: 22242, weight: 2 },
  'auth-write': { kind: 22242, weight: 8 },
  'dm-advertisement': { kind: 10050, weight: 8 },
  'dm-seal': { kind: 13, weight: 8 },
};
export function createMockSignerFixtures(core: Core) {
  let next = 0;
  const pending = new Map<string, { kind: 'sign' | 'crypt'; reply?: (message: Signed) => void }>(); // <=16 synthetic requests
  const emit = (
    message: Extract<FromEngine, { t: 'sign' | 'crypt' }>,
    reply?: (message: Signed) => void,
  ): string => {
    if (pending.size >= 16) throw new Error('mock signer fixture bound');
    pending.set(message.req, { kind: message.t, reply });
    core.post(message);
    return message.req;
  };
  return {
    coreAction(req: string, pubkey: string): string {
      return emit({
        t: 'sign',
        req,
        pubkey,
        event: JSON.stringify({ pubkey, kind: 0, created_at: 1, tags: [], content: 'fixture' }),
        weight: 8,
        expiresAt: core.now() + 60_000,
      });
    },
    sign(
      scenario: Sign,
      pubkey: string,
      originatingAction?: string,
      reply?: (message: Signed) => void,
    ): string {
      const { kind, weight } = signs[scenario];
      if (
        (scenario === 'upload' || scenario === 'upload-nip98' || scenario === 'zap') &&
        !originatingAction
      )
        throw new Error('mock signer fixture requires action');
      return emit(
        {
          t: 'sign',
          req: `upload-auth-${++next}-00000000000000000000000000000000`,
          pubkey,
          event: JSON.stringify({ pubkey, kind, created_at: 1, tags: [], content: 'fixture' }),
          weight,
          expiresAt: core.now() + 60_000,
          // DM seal and inbox advertisement are authorized Worker requests, not page actions.
          ...(scenario === 'upload' || scenario === 'upload-nip98' || scenario === 'zap'
            ? { actionReq: originatingAction }
            : {}),
        },
        reply,
      );
    },
    crypt(
      scenario: Crypt,
      pubkey: string,
      peer: string,
      list?: { sub: string; event: string },
    ): string {
      if (scenario === 'private-list' && !list)
        throw new Error('mock list fixture requires context');
      return emit({
        t: 'crypt',
        req: `dm-crypto-${(++next).toString(16).padStart(32, '0')}`,
        pubkey,
        peer,
        data: 'fixture',
        operation: scenario === 'dm-encrypt' ? 'nip44.encrypt' : 'nip44.decrypt',
        expiresAt: core.now() + 60_000,
        weight:
          scenario === 'private-list'
            ? 1
            : scenario === 'dm-background'
              ? 2
              : scenario === 'dm-visible'
                ? 4
                : 8,
        ...(scenario === 'dm-background' ? { background: true } : {}),
        ...(scenario === 'private-list' && list
          ? { context: { kind: 'private-list', ...list } }
          : {}),
      });
    },
    signed(message: Signed): boolean {
      const request = pending.get(message.req);
      if (request?.kind !== 'sign') return false;
      pending.delete(message.req);
      request.reply?.(message);
      return true;
    },
    cancel(req: string): void {
      const request = pending.get(req);
      if (!request) return;
      pending.delete(req);
      core.post({ t: request.kind === 'sign' ? 'sign.cancel' : 'crypt.cancel', req });
    },
    dispose(): void {
      pending.clear();
    },
  };
}
