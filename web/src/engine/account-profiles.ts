// Ask for every device account at boot and after sign-in. The engine chooses how to fetch them.
import type { Engine, Subscription } from './client.ts';
export function watchAccountProfiles(engine: Engine): () => void {
  let signature = '';
  let sub: Subscription | undefined;
  const open = (): void => {
    if ((engine.info.get()?.version ?? 0) < 5) return;
    const authors = engine.accounts
      .get()
      .accounts.map((a) => a.author.pubkey)
      .sort();
    const next = authors.join(':');
    if (next === signature) return;
    signature = next;
    sub?.close();
    sub = undefined;
    if (!authors.length) return;
    sub = engine.open({ source: 'people', authors }, { rows() {}, patch() {} });
    sub.window('top', 0, 32);
    sub.visible(true);
  };
  const offs = [engine.accounts.subscribe(open), engine.info.subscribe(open)];
  open();
  return () => {
    offs.forEach((off) => off());
    sub?.close();
  };
}
