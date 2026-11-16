import { describe, expect, it } from 'vitest';
import { createDmClient } from '../src/engine/client-dm.ts';
import { createMockEngine } from '../src/engine/mock/engine.ts';
import { MOCK_PASSWORD, mockEncrypted } from '../src/engine/mock/vault.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';

describe('private initial visibility', () => {
  it('opens a hidden view atomically instead of following open with a hide', () => {
    const sent: ToEngine[] = [];
    const dm = createDmClient({ post: (m) => sent.push(m), listen: () => {}, close: () => {} });
    const query = { account: 'a'.repeat(64) };
    const sub = dm.open(query, () => {}, { visible: false });
    expect(sent).toEqual([{ t: 'dm.open', sub: sub.id, query, visible: false }]);
    sub.visible(true);
    expect(sent.at(-1)).toEqual({ t: 'dm.visible', sub: sub.id, visible: true });
    dm.dispose();
  });
  it('keeps mock snapshots paused until both page and private view are shown', () => {
    const messages: FromEngine[] = [];
    const engine = createMockEngine((m) => messages.push(m));
    const account = 'a'.repeat(64);
    engine.handle({
      t: 'act',
      req: 'owned-fixture',
      action: {
        a: 'account.importEncrypted',
        key: mockEncrypted(account),
        password: MOCK_PASSWORD,
      },
    });
    const hint = { visibleSubs: [], pageHidden: false, idle: false, saveData: false };
    const snapshots = () => messages.filter((m) => m.t === 'dm' && m.sub === 'hidden');
    try {
      engine.handle({
        t: 'dm.open',
        sub: 'hidden',
        query: { account },
        visible: false,
      });
      expect(snapshots()).toHaveLength(0);
      engine.handle({ t: 'hint', hint: { ...hint, pageHidden: true } });
      engine.handle({ t: 'dm.visible', sub: 'hidden', visible: true });
      expect(snapshots()).toHaveLength(0);
      engine.handle({ t: 'hint', hint });
      expect(snapshots()).toHaveLength(1);
      engine.handle({ t: 'dm.close', sub: 'hidden' });
      engine.handle({ t: 'hint', hint: { ...hint, pageHidden: true } });
      engine.handle({ t: 'hint', hint });
      expect(snapshots()).toHaveLength(1);
    } finally {
      engine.dispose();
    }
  });
  it('reports invalid hidden openings immediately without registering a view', () => {
    const messages: FromEngine[] = [];
    const engine = createMockEngine((m) => messages.push(m));
    try {
      engine.handle({
        t: 'configure',
        config: {
          language: 'en',
          heuristics: true,
          prefetch: true,
          mock: { live: false, accounts: 'none' },
        },
      });
      engine.handle({
        t: 'hint',
        hint: { visibleSubs: [], pageHidden: true, idle: false, saveData: false },
      });
      engine.handle({
        t: 'dm.open',
        sub: 'missing',
        query: { account: 'f'.repeat(64) },
        visible: false,
      });
      const snapshots = messages.filter((m) => m.t === 'dm' && m.sub === 'missing');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({ snapshot: { phase: 'failed', error: 'signed-out' } });
      engine.handle({ t: 'dm.visible', sub: 'missing', visible: true });
      expect(messages.filter((m) => m.t === 'dm' && m.sub === 'missing')).toHaveLength(1);
    } finally {
      engine.dispose();
    }
  });
});
