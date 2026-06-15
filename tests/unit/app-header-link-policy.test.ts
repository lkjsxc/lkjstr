import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app header link policy', () => {
  it('keeps the GitHub source link on the safe external policy', () => {
    const source = readFileSync(
      'src/lib/components/app/AppHeader.svelte',
      'utf8',
    );

    expect(source).toContain('href="https://github.com/lkjsxc/lkjstr"');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});
