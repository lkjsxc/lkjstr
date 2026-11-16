// Idle is shared across live lkjstr pages; locking still applies to the shared Worker session.
import type { Engine } from '../engine/client.ts';
import { type ActivityOptions, createAccountActivity } from './account-activity.ts';
import type { SettingsStore } from './settings.ts';

const PROBE_MS = 750;
export function createIdleLock(
  engine: Engine,
  settings: SettingsStore,
  options?: ActivityOptions,
): () => void {
  let generation = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let probe: ReturnType<typeof setTimeout> | undefined;
  const attempted = new Map<string, number>(); // bound: at most 32 current accounts
  const inFlight = new Set<string>(); // bound: one outstanding lock per account
  let activity: ReturnType<typeof createAccountActivity> | undefined;
  const due = (): number => settings.get().lockIdle * 60_000;
  const eligible = () => {
    const accounts = engine.accounts.get().accounts;
    for (const key of attempted.keys())
      if (!accounts.some((a) => a.author.pubkey === key && !a.locked)) attempted.delete(key);
    return accounts.filter(
      (a) =>
        a.signer === 'local' &&
        a.encrypted &&
        !a.locked &&
        !inFlight.has(a.author.pubkey) &&
        attempted.get(a.author.pubkey) !== generation,
    );
  };
  const cancelProbe = (): void => {
    clearTimeout(probe);
    probe = undefined;
  };
  const expire = (): void => {
    probe = undefined;
    if (disposed || !activity || due() <= 0 || (engine.info.get()?.version ?? 0) < 6) return;
    if (activity.elapsed() < due()) return check();
    for (const account of eligible()) {
      const key = account.author.pubkey;
      attempted.set(key, generation);
      inFlight.add(key);
      const finish = (): void => {
        inFlight.delete(key);
        check();
      };
      void engine.act({ a: 'account.lock', pubkey: key }).then(finish, finish);
    }
  };
  function check(): void {
    clearTimeout(timer);
    if (disposed || (engine.info.get()?.version ?? 0) < 6 || due() <= 0) {
      cancelProbe();
      activity?.dispose();
      activity = undefined;
      return;
    }
    activity ??= createAccountActivity((fresh) => {
      if (fresh) generation++;
      check();
    }, options);
    const remaining = due() - activity.elapsed();
    if (remaining > 0) {
      cancelProbe();
      timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    } else if (!eligible().length) cancelProbe();
    else if (probe === undefined) {
      // A queued sibling activity message may arrive after this page's wake/timer event.
      activity.probe();
      probe = setTimeout(expire, PROBE_MS);
    }
  }
  const offs = [
    engine.accounts.subscribe(check),
    engine.info.subscribe(check),
    settings.subscribe(() => {
      generation++;
      check();
    }),
  ];
  check();
  return () => {
    disposed = true;
    clearTimeout(timer);
    cancelProbe();
    activity?.dispose();
    offs.forEach((off) => off());
    attempted.clear();
    inFlight.clear();
  };
}
