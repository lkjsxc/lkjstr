// The account switcher's press is the room around the face, not the face alone: the top bar's button, the account
// menu's people and the Accounts tab's rows all have padding that belongs to the press, larger for a finger.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const css = (name: string): string =>
  readFileSync(join(import.meta.dirname, '../src/ui', name), 'utf8');
const rule = (text: string, selector: string): string => {
  const at = text.indexOf(selector.includes('{') ? selector : `\n${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return text.slice(at, text.indexOf('}', at));
};
const px = (block: string, prop: string): number =>
  Number(new RegExp(`${prop}: (\\d+)px`).exec(block)?.[1]);

it('gives the top bar account a padded box around its 20px face, larger on a touch screen', () => {
  const ui = css('ui.css');
  const fine = rule(ui, '.acct { --ax');
  expect(px(fine, '--ax')).toBeGreaterThanOrEqual(7); // 34px wide and tall
  expect(px(fine, '--ay')).toBeGreaterThanOrEqual(7);
  expect(fine).toContain('min-width: calc(20px + 2 * var(--ax))');
  expect(fine).toContain('height: calc(20px + 2 * var(--ay))');
  const coarse = /@media \(pointer: coarse\) \{ \.acct \{ --ax: (\d+)px; --ay: (\d+)px; \} \}/.exec(
    ui,
  );
  expect(20 + 2 * Number(coarse?.[1])).toBeGreaterThanOrEqual(40);
  expect(20 + 2 * Number(coarse?.[2])).toBeLessThanOrEqual(38); // fits the bar
  // The read-only and unread marks follow the face, not the box's corner.
  expect(rule(ui, '.acct .ro')).toContain('right: calc(var(--ax) - 7px)');
  expect(rule(css('dm.css'), '.dm-dot')).toContain('right: calc(var(--ax, 4px) - 5px)');
});

it('makes account menu rows and Accounts rows tall enough to press anywhere', () => {
  expect(css('ui.css')).toContain(
    '.menu button:has(> .av) { min-height: 36px; padding-block: 8px; }',
  );
  const pages = css('pages.css');
  const main = rule(pages, '.amain');
  expect(px(main, 'min-height')).toBeGreaterThanOrEqual(44);
  expect(main).toContain('padding: 8px 10px 8px 8px');
  expect(pages).toContain('  .srow { min-height: 44px; }\n  .amain { min-height: 52px; }'); // in the touch block
});
