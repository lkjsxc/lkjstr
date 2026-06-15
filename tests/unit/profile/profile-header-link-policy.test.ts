import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('profile header link policy', () => {
  it('keeps retained Svelte website links on the safe external policy', () => {
    const source = readFileSync(
      'src/lib/tabs/profile/ProfileHeader.svelte',
      'utf8',
    );

    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});
