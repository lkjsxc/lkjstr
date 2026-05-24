import { describe, expect, it } from 'vitest';
import {
  canonicalRootDocLinks,
  isStrictDoc,
  rootDocLinkProblems,
} from '../../scripts/repo-doc-rules';

describe('repository documentation rules', () => {
  it('limits strict documentation to root docs and docs tree markdown', () => {
    expect(isStrictDoc('README.md', '.md')).toBe(true);
    expect(isStrictDoc('AGENTS.md', '.md')).toBe(true);
    expect(isStrictDoc('docs/product/README.md', '.md')).toBe(true);
    expect(isStrictDoc('docs/product/tools/tweet.md', '.md')).toBe(true);
    expect(isStrictDoc('tests/README.md', '.md')).toBe(false);
    expect(isStrictDoc('scripts/README.md', '.md')).toBe(false);
    expect(isStrictDoc('static/README.md', '.md')).toBe(false);
  });

  it('requires root docs to point to canonical docs', () => {
    const complete = canonicalRootDocLinks
      .map((target) => `- [${target}](${target})`)
      .join('\n');

    expect(rootDocLinkProblems('README.md', complete)).toEqual([]);
    expect(rootDocLinkProblems('AGENTS.md', complete)).toEqual([]);
    expect(rootDocLinkProblems('README.md', '[docs](docs/README.md)')).toEqual([
      {
        file: 'README.md',
        message: 'root doc missing docs/current-state.md',
      },
    ]);
    expect(rootDocLinkProblems('tests/README.md', '')).toEqual([]);
  });
});
