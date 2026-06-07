import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = () => readFileSync('src/styles/scroll-layout.css', 'utf8');
const feedScrollSurface = () =>
  readFileSync('src/lib/components/feed/FeedScrollSurface.svelte', 'utf8');
const formTabShell = () =>
  readFileSync('src/lib/components/workspace/FormTabShell.svelte', 'utf8');

describe('scroll layout css', () => {
  it('uses one shared track-edge scroller for feed and form tabs', () => {
    const source = css();

    expect(source).toContain('--scroll-track-edge: var(--space-2);');
    expect(source).toContain(
      '.tab-scroll-track,\n.event-list__scroller,\n.form-tab__scroller',
    );
    expect(source).toContain('padding-inline-end: var(--scroll-track-edge);');
    expect(source).toContain('.notification-list-scroll');
  });

  it('keeps the scroll owner inside the padded scroller wrapper', () => {
    const source = css();

    expect(source).toContain('.tab-scroll-owner,\n.event-list__viewport');
    expect(source).toContain('.form-tab__scroll');
    expect(source).toContain('overflow-x: clip;\n  overflow-y: auto;');
    expect(source).not.toMatch(
      /\.form-tab__scroll\s*\{[^}]*padding-inline-end:\s*var\(--scroll-track-edge\)/s,
    );
    expect(source).not.toContain(
      'margin-inline-end: var(--scroll-track-edge);',
    );
    expect(source).not.toMatch(/\.form-tab__scroll\s*\{[^}]*overflow:\s*auto/s);
  });

  it('reserves the same platform gutter on feed and form tab roots', () => {
    const source = css();

    expect(source).toMatch(/\.form-tab\s*\{[^}]*scrollbar-gutter:\s*stable;/s);
    expect(source).toMatch(/\.feed-tab\s*\{[^}]*scrollbar-gutter:\s*stable;/s);
  });

  it('stamps shared scroll classes on feed and form scroll hosts', () => {
    expect(feedScrollSurface()).toContain(
      '<div class={`${scrollerClass} tab-scroll-track`}',
    );
    expect(feedScrollSurface()).toContain(
      'class={`${viewportClass} tab-scroll-owner`}',
    );
    expect(formTabShell()).toContain(
      'class="tab-scroll-track form-tab__scroller"',
    );
    expect(formTabShell()).toContain(
      'class="tab-scroll-owner form-tab__scroll"',
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
