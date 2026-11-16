// M6 uses only the protocol-8 count projection; older engines never receive a frame inbox query.
import type { SettingsStore } from '../shared/settings.ts';
import { createSignal } from '../shared/signal.ts';
import type { Engine } from './client.ts';
export function createDmWatch(engine: Engine, settings: SettingsStore) {
  const unread = createSignal(0);
  let sub: ReturnType<NonNullable<Engine['dm']>['open']> | undefined,
    signature = '',
    stopped = false;
  const sync = (): void => {
    if (stopped) return;
    const account = engine.accounts.get().accounts.find((a) => a.author.pubkey === engine.me());
    const ready =
      (engine.info.get()?.version ?? 0) >= 8 &&
      settings.get().dmWatch &&
      document.visibilityState !== 'hidden' &&
      account &&
      engine.dm?.access.status(account) === 'ready';
    const next = ready ? account.author.pubkey : '';
    if (next === signature) return;
    signature = next;
    sub?.close();
    sub = undefined;
    unread.set(0);
    if (next) {
      sub = engine.dm?.open(
        { account: next, unreadOnly: true },
        (value) => {
          if (!stopped && signature === next)
            unread.set(value.phase === 'failed' ? 0 : (value.unread ?? 0));
        },
        { visible: true },
      );
      sub?.visible(true);
    }
  };
  const offs = [
    engine.accounts.subscribe(sync),
    engine.info.subscribe(sync),
    settings.subscribe(sync),
  ];
  if (engine.dm) offs.push(engine.dm.access.changed.subscribe(sync));
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    unread,
    dispose(): void {
      stopped = true;
      sub?.close();
      offs.forEach((off) => off());
      document.removeEventListener('visibilitychange', sync);
      unread.set(0);
    },
  };
}
