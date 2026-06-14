import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const islandHosts = [
  'src/lib/tabs/author-context/AuthorContextTab.svelte',
  'src/lib/tabs/followees/FolloweesTab.svelte',
  'src/lib/tabs/user-timeline/UserTimelineTab.svelte',
];

describe('Rust island action callbacks', () => {
  it('does not pass no-op Author Context callbacks into Rust islands', () => {
    for (const file of [
      'src/lib/tabs/author-context/AuthorContextTab.svelte',
      'src/lib/tabs/user-timeline/UserTimelineTab.svelte',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain(
        'openAuthorContext: (eventId: string, pubkey: string) => void;',
      );
      expect(source, file).not.toContain('openAuthorContext?:');
      expect(source, file).not.toContain('?? (() => {})');
    }
  });

  it('cancels pending island mounts when hosts hide or destroy', () => {
    for (const file of islandHosts) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('function cancelIsland(): void');
      expect(source, file).toContain('generation += 1;');
      expect(source, file).toContain('if (!key) {\n      cancelIsland();');
      expect(source, file).toContain('onDestroy(() => {\n    cancelIsland();');
      expect(source, file).not.toContain(
        'if (!key) {\n      releaseIsland();',
      );
    }
  });
});
