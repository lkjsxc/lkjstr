import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../', import.meta.url);
const inlineCss = readFileSync(
  new URL('src/styles/content-warning.css', root),
  'utf8',
);
const appCss = readFileSync(new URL('src/styles/app.css', root), 'utf8');

describe('custom emoji CSS', () => {
  it('keeps inline custom emoji intrinsic width with an inline cap', () => {
    const block = cssBlock(inlineCss, '.custom-emoji');

    expect(block).toContain('height: 1.25em;');
    expect(block).toContain('max-width: 6em;');
    expect(block).toContain('width: auto;');
    expect(block).not.toContain('width: 1.25em;');
    expect(block).not.toContain('max-width: 1.25em;');
  });

  it('keeps picker custom emoji bounded inside icon buttons', () => {
    const block = cssBlock(appCss, '.emoji-popover__custom .custom-emoji');

    expect(block).toContain('height: 1.25rem;');
    expect(block).toContain('max-height: 1.25rem;');
    expect(block).toContain('max-width: 1.5rem;');
  });
});

function cssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`).exec(css);
  expect(match?.groups?.body).toBeTruthy();
  return match?.groups?.body ?? '';
}
