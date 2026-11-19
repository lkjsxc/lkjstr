// M6 uses only the protocol-8 count projection; older engines never receive a frame inbox query.
import type { SettingsStore } from '../shared/settings.ts';
import { createSignal, type Signal } from '../shared/signal.ts';
import type { Engine } from './client.ts';
export function writingHasPriority(posting?: Pick<Signal<boolean>, 'get'>): boolean {
  return posting?.get() === true || document.activeElement?.closest('.view.compose') != null;
}
export function createDmWatch(engine: Engine, settings: SettingsStore) {
  const unread = createSignal(0);
  let sub: ReturnType<NonNullable<Engine['dm']>['open']> | undefined,
    signature = '',
    owner = '',
    stopped = false;
  const sync = (): void => {
    if (stopped) return;
    const account = engine.accounts.get().accounts.find((a) => a.author.pubkey === engine.me());
    const pubkey = account?.author.pubkey ?? '';
    if (owner !== pubkey) (owner = pubkey), unread.set(0);
    const writing = writingHasPriority(engine.posting);
    const ready =
      (engine.info.get()?.version ?? 0) >= 8 &&
      settings.get().dmWatch &&
      document.visibilityState !== 'hidden' &&
      account &&
      engine.dm?.access.status(account) === 'ready';
    const next = ready && !writing ? account.author.pubkey : '';
    if (next === signature) return;
    signature = next;
    sub?.close();
    sub = undefined;
    if (!ready) unread.set(0);
    if (next) {
      sub = engine.dm?.open(
        { account: next, unreadOnly: true },
        (value) => {
          if (!stopped && signature === next) {
            if (value.phase === 'failed') unread.set(0);
            else if (value.unread !== undefined) unread.set(value.unread);
          }
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
  const focus = (): void => queueMicrotask(sync);
  if (engine.posting) offs.push(engine.posting.subscribe(sync));
  if (engine.dm) offs.push(engine.dm.access.changed.subscribe(sync));
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('focusin', focus);
  document.addEventListener('focusout', focus);
  sync();
  return {
    unread,
    dispose(): void {
      stopped = true;
      sub?.close();
      offs.forEach((off) => off());
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', focus);
      unread.set(0);
    },
  };
}
