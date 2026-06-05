import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('media attachment hitbox contract', () => {
  it('uses image-specific inline link styling', () => {
    const component = readFileSync(
      'src/lib/components/events/MediaAttachment.svelte',
      'utf8',
    );
    const css = readFileSync('src/styles/media-embed.css', 'utf8');
    expect(component).toContain('media-embed--image-link');
    expect(component).toContain('media-embed__image');
    expect(css).toContain('.media-embed--image-link');
    expect(css).toContain('display: inline-flex');
    expect(css).toContain('inline-size: fit-content');
  });
});
