import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const islandHosts = [
  'src/lib/tabs/author-context/AuthorContextTab.svelte',
  'src/lib/tabs/user-timeline/UserTimelineTab.svelte',
];

describe('Rust island action callbacks', () => {
  it('does not pass no-op Author Context callbacks into Rust islands', () => {
    for (const file of islandHosts) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain(
        'openAuthorContext: (eventId: string, pubkey: string) => void;',
      );
      expect(source, file).not.toContain('openAuthorContext?:');
      expect(source, file).not.toContain('?? (() => {})');
    }
  });
});
