import { afterEach, expect, it } from 'vitest';
import { migrateStorage, oldDefault } from '../src/shared/migrate.ts';
import { kv } from '../src/shared/storage.ts';
import { pane, panes, split } from '../src/wm/layout.ts';

afterEach(() => localStorage.clear());
it('replaces only byte-identical old defaults and is idempotent', () => {
  const old = split(
    'row',
    [pane(['home', 'global']), pane(['notifications', 'compose'])],
    [0.56, 0.44],
  );
  expect(oldDefault(old, 'main')).toBe(true);
  expect(oldDefault({ ...old, sizes: [0.55, 0.45] }, 'main')).toBe(false);
  expect(oldDefault({ type: 'split', children: [null] }, 'main')).toBe(false);
  kv.set('layout:main', old);
  kv.set('layout:guest', pane(['global']));
  migrateStorage();
  const saved = kv.get('layout:main');
  expect(JSON.stringify(saved)).toContain('settings');
  migrateStorage();
  expect(kv.get('layout:main')).toEqual(saved);
});
it('repairs retired tabs in place without overwriting Docs, settings or a custom split', () => {
  const old = split(
    'row',
    [pane(['home', 'shortcuts', 'about', 'compose'], 'about'), pane(['docs'])],
    [0.7, 0.3],
  );
  kv.set('layout:main', old);
  kv.set('settings', { textSize: 19 });
  kv.set('view:main1:docs', { page: 'privacy' });
  kv.set('view:main1:compose', { text: 'draft', title: '書く' });
  kv.set('view:main1:home', { filter: { range: 'week', text: 'query' }, place: { key: 'anchor' } });
  kv.set('closed:main1', [{ kind: 'shortcuts', state: {}, pane: 'a', index: 1 }]);
  migrateStorage();
  const repaired = kv.get('layout:main') as typeof old;
  expect(repaired.sizes).toEqual(old.sizes);
  expect(panes(repaired).map((p) => p.id)).toEqual(panes(old).map((p) => p.id));
  expect(panes(repaired)[0]?.tabs).toEqual(['home', 'docs~2', 'docs~3', 'compose']);
  expect(panes(repaired)[0]?.active).toBe('docs~3');
  expect(kv.get('view:main1:docs')).toEqual({ page: 'privacy' });
  expect(kv.get('view:main1:docs~3')).toEqual({ page: 'about' });
  expect(kv.get('view:main1:compose')).toEqual({ text: 'draft' });
  expect(kv.get('view:main1:home')).toMatchObject({
    filter: { text: 'query', start: expect.any(String) },
    place: { key: 'anchor' },
  });
  expect(kv.get('settings')).toEqual({ textSize: 19 });
  expect(kv.get('closed:main1')).toMatchObject([{ kind: 'docs', state: { page: 'shortcuts' } }]);
});
