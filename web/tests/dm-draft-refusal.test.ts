import { afterEach, beforeEach, expect, it } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountMessage } from '../src/views/message.ts';
import { dmEnv, OTHER, ROOM } from './dm-ui-fixture.ts';
import { account, deferred, PUBKEY, success, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());
async function settled() {
  for (let i = 0; i < 8; i++) await tick();
}
it('retains an unsaved refused editor through Retry, but actual lock purges its private pool', async () => {
  const x = dmEnv({ signer: 'extension' });
  x.dm.access.allow(PUBKEY);
  saveViewState(x.env.instance, { participants: [OTHER] });
  const stop = mountMessage(x.el, x.env);
  try {
    await settled();
    x.answer({ conversation: ROOM, blocked: [] });
    const area = x.el.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'tail before refusal';
    area.dispatchEvent(new Event('input'));
    x.dm.access.block(PUBKEY, 'signer-refused');
    expect(x.el.querySelector('textarea')).toBeNull();
    x.dm.access.retry(PUBKEY);
    await settled();
    expect(x.el.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('tail before refusal');
    expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.draft.load')).toHaveLength(1);
    x.accounts.set({ active: PUBKEY, accounts: [account({ signer: 'extension', locked: true })] });
    expect(x.el.querySelector('textarea')).toBeNull();
    x.accounts.set({ active: PUBKEY, accounts: [account({ signer: 'extension' })] });
    await settled();
    expect(x.el.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('');
    expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.draft.load')).toHaveLength(2);
  } finally {
    stop();
    x.dispose();
  }
});
it('a send settling while the refused view is unmounted retains its honest terminal row without resending', async () => {
  const x = dmEnv({ signer: 'extension' }),
    pending = deferred<ActResult>();
  x.dm.access.allow(PUBKEY);
  saveViewState(x.env.instance, { participants: [OTHER] });
  x.act.mockImplementation(async (a) =>
    a.a === 'dm.send' ? pending.promise : success({ dmDraftRevision: 'saved' }),
  );
  const stop = mountMessage(x.el, x.env);
  try {
    await settled();
    x.answer({ conversation: ROOM, blocked: [] });
    const area = x.el.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'pending while refused';
    area.dispatchEvent(new Event('input'));
    (x.el.querySelector('.cbar .btn') as HTMLButtonElement).click();
    await settled();
    expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.send')).toHaveLength(1);
    x.dm.access.block(PUBKEY, 'signer-refused');
    pending.resolve(
      success({
        ok: false,
        error: { code: 'no-relays' },
        dmDelivery: { accepted: 1, total: 2 },
        id: 'e'.repeat(64),
      }),
    );
    await settled();
    expect(x.el.textContent).not.toContain('pending while refused');
    x.dm.access.retry(PUBKEY);
    await settled();
    expect(x.el.textContent).toContain('pending while refused');
    expect(x.el.textContent).toContain('Reached 1 of 2 people');
    expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.send')).toHaveLength(1);
  } finally {
    stop();
    x.dispose();
  }
});
