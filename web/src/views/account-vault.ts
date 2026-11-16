// Password-protected accounts use protocol 6; tab state carries only a public unlock target.
import type { Engine } from '../engine/client.ts';
import type { Account, Failure } from '../engine/protocol.ts';
import type { Key } from '../shared/i18n.ts';
import type { ViewEnv } from './registry.ts';

export type AccountBox = {
  el: HTMLElement;
  dispose(): void;
  focus?(): void;
};
export const canVault = (engine: Engine): boolean => (engine.info.get()?.version ?? 0) >= 6;
export const protectedAccount = (engine: Engine, account: Account | undefined): boolean =>
  account?.signer === 'local' && account.encrypted === true && canVault(engine);
export const lockedAccount = (engine: Engine, account: Account | undefined): boolean =>
  protectedAccount(engine, account) && account?.locked === true;
export const signerLabel = (engine: Engine, account: Account): Key =>
  protectedAccount(engine, account)
    ? account.locked
      ? 'account.signer.locked'
      : 'account.signer.protected'
    : `account.signer.${account.signer}`;

export function openAccountUnlock(env: Pick<ViewEnv, 'open' | 'engine'>, pubkey?: string): void {
  env.open('account', { unlock: pubkey ?? env.engine.me() });
}

export const vaultFailure = (
  code: Failure['code'] | undefined,
  kind: 'unlock' | 'import' | 'choose',
): Key => {
  if (code === 'too-large') return 'account.fail.heavy';
  if (code === 'signer-timeout') return 'dm.fail.timeout';
  if (code === 'rejected' && kind !== 'choose')
    return kind === 'unlock' ? 'account.fail.password' : 'account.fail.encrypted';
  return `error.${code ?? 'internal'}`;
};
