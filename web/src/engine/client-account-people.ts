// Hydrated public names update remembered account rows without replacing other account fields.
import { onPerson } from '../shared/people.ts';
import type { Signal } from '../shared/signal.ts';
import type { Accounts } from './client-api.ts';

export function watchAccountPeople(accounts: Signal<Accounts>): () => void {
  return onPerson((author) => {
    const value = accounts.get();
    if (
      !value.accounts.some(
        (a) =>
          a.author.pubkey === author.pubkey && JSON.stringify(a.author) !== JSON.stringify(author),
      )
    )
      return;
    accounts.set({
      ...value,
      accounts: value.accounts.map((a) =>
        a.author.pubkey === author.pubkey ? { ...a, author } : a,
      ),
    });
  });
}
