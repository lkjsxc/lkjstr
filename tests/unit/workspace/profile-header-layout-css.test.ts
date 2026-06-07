import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('profile header layout css', () => {
  it('keeps about spacing before the first note row', () => {
    const source = readFileSync('src/styles/identity.css', 'utf8');

    expect(source).toContain('.profile-card__about');
    expect(source).toContain('margin: 0 0 var(--space-5)');
    expect(source).toContain('.profile-card__identity');
    expect(source).toContain('gap: var(--space-1)');
  });
});
