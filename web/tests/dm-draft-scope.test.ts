import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { t } from '../src/shared/i18n.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { createDmDraftStore } from '../src/views/dm-draft-store.ts';
import { mountMessage } from '../src/views/message.ts';
import { dmEnv, OTHER, ROOM } from './dm-ui-fixture.ts';
import { failure, PUBKEY, success, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());
it.each(['editor', 'retained'])(
  'does not restore or overwrite an archive whose %s belongs to different people',
  async (part) => {
    const x = dmEnv(),
      rejected = vi.fn(),
      wrong = 'f'.repeat(64);
    x.act.mockResolvedValueOnce(
      success({
        dmDraftRevision: 'original',
        dmDraft: {
          draft: { recipients: [part === 'editor' ? wrong : OTHER], text: 'old private text' },
          failed: [
            {
              key: 'old',
              draft: {
                recipients: [part === 'retained' ? wrong : OTHER],
                text: 'old retained text',
              },
            },
          ],
        },
      }),
    );
    const store = createDmDraftStore({
      env: x.env,
      account: PUBKEY,
      recipients: [OTHER],
      changed() {},
      failed: rejected,
    });
    try {
      await tick();
      await tick();
      expect(store.ready()).toBe(false);
      expect(store.get().draft.text).toBe('');
      expect(store.get().failed).toEqual([]);
      expect(rejected).toHaveBeenCalledWith({ code: 'rejected' });
      store.draft({ recipients: [OTHER], text: 'must not overwrite' });
      await store.flush();
      expect(x.act.mock.calls.some(([a]) => a.a === 'dm.draft.save')).toBe(false);
    } finally {
      store.dispose();
      x.dispose();
    }
  },
);
it.each(['storage failure', 'missing revision'])(
  'an initial load with %s disables editing until an explicit retry safely restores the same conversation',
  async (reason) => {
    const x = dmEnv();
    saveViewState(x.env.instance, { participants: [OTHER] });
    x.act.mockResolvedValueOnce(reason === 'storage failure' ? failure('internal') : success());
    const stop = mountMessage(x.el, x.env);
    try {
      await tick();
      await tick();
      x.answer({ conversation: ROOM, blocked: [] });
      const area = x.el.querySelector<HTMLTextAreaElement>('textarea')!;
      expect(area.disabled).toBe(true);
      expect(x.el.querySelector('.dm-compose')?.textContent).not.toContain(t('dm.loading'));
      expect(x.act.mock.calls.some(([a]) => a.a === 'dm.draft.save')).toBe(false);
      x.act.mockResolvedValueOnce(
        success({
          dmDraftRevision: 'restored',
          dmDraft: { draft: { recipients: [OTHER], text: 'safe retained input' }, failed: [] },
        }),
      );
      const retry = [...x.el.querySelectorAll<HTMLButtonElement>('.dm-compose button')].find(
        (button) => button.textContent === t('dm.retry'),
      );
      expect(retry).toBeDefined();
      retry?.click();
      await tick();
      await tick();
      expect(area.disabled).toBe(false);
      expect(area.value).toBe('safe retained input');
      expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.draft.load')).toHaveLength(2);
      expect(x.act.mock.calls.some(([a]) => a.a === 'dm.send' || a.a === 'dm.draft.save')).toBe(
        false,
      );
    } finally {
      stop();
      x.dispose();
    }
  },
);
