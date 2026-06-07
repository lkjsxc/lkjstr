import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = () => readFileSync('src/styles/hybrid-tab.css', 'utf8');

describe('hybrid tab css', () => {
  it('keeps the toolbar outside the feed scroll owner', () => {
    const source = css();

    expect(source).toContain('.hybrid-tab__toolbar');
    expect(source).toContain('flex: 0 0 auto');
    expect(source).toContain('.hybrid-tab > .event-list');
  });
});
