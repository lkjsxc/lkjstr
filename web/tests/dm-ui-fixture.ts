import { vi } from 'vitest';
import type { Transport } from '../src/engine/client.ts';
import { createDmClient } from '../src/engine/client-dm.ts';
import type { Account, DmMessage, DmSnapshot, ToEngine } from '../src/engine/protocol.ts';
import { account, PUBKEY, success, vaultEnv } from './vault-ui-fixture.ts';
export const OTHER = 'b'.repeat(64),
  ROOM = 'c'.repeat(64);
export function dmEnv(extra: Partial<Account> = {}, version = 8) {
  const fixture = vaultEnv(extra, version),
    sent: ToEngine[] = [];
  const transport: Transport = { post: (message) => sent.push(message), listen() {}, close() {} };
  const dm = createDmClient(transport);
  fixture.act.mockResolvedValue(success({ dmDraftRevision: 'fixture-initial' }));
  const editorAct = vi.fn().mockResolvedValue(success());
  fixture.env.engine.act = (action) =>
    action.a === 'dm.editor' ? editorAct(action) : fixture.act(action);
  Object.assign(fixture.env.engine, { dm });
  dm.access.accounts(fixture.accounts.get().accounts);
  const off = fixture.accounts.subscribe((value) => dm.access.accounts(value.accounts));
  return {
    ...fixture,
    sent,
    dm,
    editorAct,
    answer(snapshot: Partial<DmSnapshot>, sub?: string): void {
      const id =
        sub ??
        sent.filter((m): m is Extract<ToEngine, { t: 'dm.open' }> => m.t === 'dm.open').at(-1)?.sub;
      if (id)
        dm.receive({
          t: 'dm',
          sub: id,
          snapshot: {
            account: PUBKEY,
            conversations: [],
            messages: [],
            phase: 'live',
            more: false,
            undecryptable: 0,
            ...snapshot,
          },
        });
    },
    dispose(): void {
      off();
      dm.dispose();
      fixture.dispose();
    },
  };
}
export function message(extra: Partial<DmMessage> = {}): DmMessage {
  return {
    id: 'd'.repeat(64),
    conversation: ROOM,
    author: OTHER,
    participants: [PUBKEY, OTHER],
    at: Date.now(),
    text: 'Only inside this private view.',
    replyTo: null,
    subject: null,
    unread: true,
    legacy: false,
    ...extra,
  };
}
export const authors = [
  account().author,
  { pubkey: OTHER, npub: 'npub1other012345678', name: 'Other person' },
];
