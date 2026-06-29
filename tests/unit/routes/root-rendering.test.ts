import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ssr } from '../../../src/routes/+page';

describe('root route rendering contract', () => {
  it('keeps the browser workspace out of Cloudflare Worker SSR', () => {
    expect(ssr).toBe(false);
  });

  it('releases retained TypeScript storage before Rust feed mount', () => {
    const source = readFileSync('src/routes/+page.svelte', 'utf8');
    const load = source.indexOf('await loadWorkspacePageData()');
    const close = source.indexOf('await closeSqliteStorage();', load);
    const ready = source.indexOf('pageDataReady = true;', load);
    expect(load).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(load);
    expect(ready).toBeGreaterThan(close);
  });
});
