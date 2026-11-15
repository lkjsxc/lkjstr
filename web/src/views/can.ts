// Whether the reader can write, and what is said when they cannot. A visitor who is signed out and an account
// that is only a public key both read everything; the controls that would publish are drawn off, and a press on
// one says why and offers the way forward instead of failing afterwards.
import type { Engine } from '../engine/client.ts';
import { t } from '../shared/i18n.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export type Ability = 'ok' | 'signed-out' | 'read-only';

export function ability(engine: Engine): Ability {
  const a = engine.accounts.get();
  if (!a.active) return 'signed-out';
  return a.accounts.find((x) => x.author.pubkey === a.active)?.signer === 'none'
    ? 'read-only'
    : 'ok';
}

/** The reason in words, with the way to the accounts. */
export function denied(env: ViewEnv, why: Exclude<Ability, 'ok'>): void {
  toast(
    env.layer,
    t(`error.${why}`),
    () => env.open('account'),
    t(why === 'signed-out' ? 'bar.signedOut' : 'view.account'),
  );
}
/** True when the reader can write; otherwise says why not. */
export function able(env: ViewEnv): boolean {
  const why = ability(env.engine);
  if (why !== 'ok') denied(env, why);
  return why === 'ok';
}
