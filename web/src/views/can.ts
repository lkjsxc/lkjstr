// Whether the reader can write, and what is said when they cannot. A visitor who is signed out and an account
// that is only a public key both read everything; the controls that would publish are drawn off, and a press on
// one says why and offers the way forward instead of failing afterwards.
import type { Engine } from '../engine/client.ts';
import type { Failure } from '../engine/protocol.ts';
import { type Key, t } from '../shared/i18n.ts';
import { canVault, lockedAccount, openAccountUnlock } from './account-vault.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export type Ability = 'ok' | 'signed-out' | 'read-only' | 'locked';

export function ability(engine: Engine): Ability {
  const a = engine.accounts.get();
  if (!a.active) return 'signed-out';
  const account = a.accounts.find((x) => x.author.pubkey === a.active);
  if (
    lockedAccount(engine, account) ||
    (account?.signer === 'local' && account.encrypted && account.locked && !engine.info.get())
  )
    return 'locked';
  return account?.signer === 'none' ? 'read-only' : 'ok';
}

export const abilityText = (why: Ability): string =>
  why === 'ok' ? '' : t(why === 'locked' ? 'account.locked.toast' : `error.${why}`);

/** The engine understands the whole filter query, the people to keep, notifications in a timeline and the kinds
 * of a profile (protocol 3). Controls it cannot serve are not drawn. */
export const rich = (engine: Engine): boolean => (engine.info.get()?.version ?? 0) >= 3;

/** Why an action failed, in words, with what came from outside (a relay, a server, the signer). */
export const failureText = (e: Failure | undefined): string =>
  e?.code === 'cancelled'
    ? t('signer.cancelled')
    : `${t(e?.code === 'signer-timeout' ? 'dm.fail.timeout' : (`error.${e?.code ?? 'internal'}` as Key))}${e?.message ? `: ${e.message}` : ''}`;

/** The reason in words, with the way to the accounts. */
export function denied(env: ViewEnv, why: Exclude<Ability, 'ok'>): void {
  const pubkey = env.engine.me();
  const unlock = why === 'locked' && canVault(env.engine);
  toast(
    env.layer,
    abilityText(why),
    () => (why === 'locked' ? openAccountUnlock(env, pubkey) : env.open('account')),
    t(unlock ? 'account.unlock' : why === 'signed-out' ? 'bar.signedOut' : 'view.account'),
  );
}
/** True when the reader can write; otherwise says why not. */
export function able(env: ViewEnv): boolean {
  const why = ability(env.engine);
  if (why !== 'ok') denied(env, why);
  return why === 'ok';
}
