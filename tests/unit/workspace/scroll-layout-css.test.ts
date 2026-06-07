import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = () => readFileSync('src/styles/scroll-layout.css', 'utf8');

describe('scroll layout css', () => {
  it('uses one shared feed scrollbar inset for timelines and notifications', () => {
    const source = css();

    expect(source).toContain('--scroll-track-edge: var(--space-2);');
    expect(source).toContain('.event-list__scroller');
    expect(source).toContain('padding-inline-end: var(--scroll-track-edge);');
    expect(source).toContain('.notification-list-scroll');
  });

  it('uses the feed-matching track-edge padding on form scroll roots', () => {
    const source = css();

    expect(source).toContain('.form-tab__scroll');
    expect(source).toContain('padding-inline-end: var(--scroll-track-edge);');
    expect(source).not.toContain(
      'margin-inline-end: var(--scroll-track-edge);',
    );
    expect(source).not.toContain(
      'margin-inline-end: var(--scroll-content-inset);',
    );
  });

  it('documents hybrid feed tabs with one event-list child inset rule', () => {
    const source = css();

    expect(source).toContain('.hybrid-tab.feed-tab');
    expect(source).toContain('.hybrid-tab > .event-list');
  });

  it('keeps feed tab roots free of horizontal padding', () => {
    const source = css();

    expect(source).toContain(
      '.feed-tab {\n  box-sizing: border-box;\n  padding-inline: 0;',
    );
    expect(source).not.toMatch(
      /\.profile-tab,\s*\n\.timeline-tab,\s*\n\.followees-tab/,
    );
  });
});
