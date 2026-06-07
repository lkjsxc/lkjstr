import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('emoji palette button', () => {
  it('defaults event picker placement to bottom-start', () => {
    const source = readFileSync(
      'src/lib/components/emoji/EmojiPaletteButton.svelte',
      'utf8',
    );

    expect(source).toContain("props.preferred ?? 'bottom-start'");
    expect(source).toContain('AnchoredPopover');
    expect(source).toContain('EmojiPopover');
  });

  it('keeps event actions on the canonical palette entry point', () => {
    const source = readFileSync(
      'src/lib/components/events/EventActions.svelte',
      'utf8',
    );

    expect(source).toContain('EmojiPaletteButton');
    expect(source).not.toContain('EmojiPopover');
  });
});
