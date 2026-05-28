import { describe, expect, it } from 'vitest';
import {
  canonicalRootDocLinks,
  isStrictDoc,
  readmeTocHeadingProblems,
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

  it('requires the canonical README TOC heading', () => {
    expect(
      readmeTocHeadingProblems(
        'src/README.md',
        '# Source\n\n## Purpose\n\nx\n\n## Table of Contents\n\n- a\n',
      ),
    ).toEqual([]);
    expect(
      readmeTocHeadingProblems(
        'src/README.md',
        '# Source\n\n## Purpose\n\nx\n\n## Contents\n\n- a\n',
      ),
    ).toEqual([
      {
        file: 'src/README.md',
        message: 'README TOC heading must be Table of Contents',
      },
      {
        file: 'src/README.md',
        message: 'README uses nonstandard TOC heading ## Contents',
      },
    ]);
    expect(readmeTocHeadingProblems('docs/page.md', '')).toEqual([]);
  });
});
