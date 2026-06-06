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

  it('uses the same track-edge token for tool-style scroll roots', () => {
    const source = css();

    expect(source).toContain('margin-inline-end: var(--scroll-track-edge);');
    expect(source).not.toContain(
      'margin-inline-end: var(--scroll-content-inset);',
    );
  });
});
