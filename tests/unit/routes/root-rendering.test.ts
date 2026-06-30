import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ssr } from '../../../src/routes/+page';

describe('root route rendering contract', () => {
  it('keeps the browser workspace out of Cloudflare Worker SSR', () => {
    expect(ssr).toBe(false);
  });

  it('keeps the app broker open before Rust feed mount', () => {
    const source = readFileSync('src/routes/+page.svelte', 'utf8');
    const load = source.indexOf('await loadWorkspacePageData()');
    const ready = source.indexOf('pageDataReady = true;', load);
    const pagehideClose = source.indexOf('void closeSqliteStorage();');
    expect(source).toContain("import '$lib/storage/sqlite-opfs/app-broker';");
    expect(load).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(load);
    expect(source.indexOf('await closeSqliteStorage();', load)).toBe(-1);
    expect(pagehideClose).toBeGreaterThan(-1);
  });
});
