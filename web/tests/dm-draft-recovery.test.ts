import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDmDraftStore } from '../src/views/dm-draft-store.ts';
import { dmEnv, OTHER } from './dm-ui-fixture.ts';
import { failure, PUBKEY, success, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());
it.each(['attempt', 'confirmed', 'conflict'])(
  'refreshes a lost-save token only against the %s snapshot',
  async (disk) => {
    const x = dmEnv(),
      errors = vi.fn();
    const store = createDmDraftStore({
      env: x.env,
      account: PUBKEY,
      recipients: [OTHER],
      changed() {},
      failed: errors,
    });
    try {
      await tick();
      await tick();
      const first = { draft: { recipients: [OTHER], text: 'first attempted' }, failed: [] };
      x.act.mockResolvedValueOnce(failure('offline'));
      store.draft(first.draft);
      expect(await store.flush()).toBe(false);
      store.draft({ recipients: [OTHER], text: 'newer local tail' });
      x.act
        .mockResolvedValueOnce(
          success({
            dmDraftRevision: 'disk-after-reconnect',
            ...(disk === 'confirmed'
              ? {}
              : {
                  dmDraft:
                    disk === 'attempt'
                      ? first
                      : { ...first, draft: { ...first.draft, text: 'another writer' } },
                }),
          }),
        )
        .mockResolvedValueOnce(success({ dmDraftRevision: 'newer-committed' }));
      const writes = x.act.mock.calls.filter(([a]) => a.a === 'dm.draft.save').length;
      expect(await store.flush()).toBe(disk !== 'conflict');
      expect(store.get().draft.text).toBe('newer local tail');
      const added = x.act.mock.calls.filter(([a]) => a.a === 'dm.draft.save').slice(writes);
      if (disk === 'conflict') {
        expect(added).toEqual([]);
        expect(errors).toHaveBeenLastCalledWith({ code: 'rejected' });
        expect(store.retryable()).toBe(true);
      } else {
        expect(added).toHaveLength(1);
        expect(added[0]?.[0]).toMatchObject({
          expected: 'disk-after-reconnect',
          state: { draft: { text: 'newer local tail' } },
        });
      }
    } finally {
      store.dispose(true);
      x.dispose();
    }
  },
);
