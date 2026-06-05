import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('tweet composer layout contract', () => {
  it('keeps attachments above a stable footer and publish area', () => {
    const composer = readFileSync(
      'src/lib/tabs/tweet/TweetComposer.svelte',
      'utf8',
    );
    const controls = readFileSync(
      'src/lib/tabs/tweet/TweetMediaControls.svelte',
      'utf8',
    );

    expect(composer.indexOf('tweet-composer__attachments')).toBeLessThan(
      composer.indexOf('tweet-composer__footer'),
    );
    expect(composer).toContain('data-testid="tweet-composer-footer"');
    expect(controls).toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(controls).toContain('inline-size: 9rem');
    expect(controls).toContain('data-testid="tweet-publish-area"');
  });
});
