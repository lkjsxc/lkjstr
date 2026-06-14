import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const islandHosts = [
  'src/lib/components/workspace/RustIslandHost.svelte',
];

describe('Rust island action callbacks', () => {
  it('does not pass no-op Author Context callbacks into Rust islands', () => {
    for (const file of [
      'src/lib/components/workspace/author-context-island.ts',
      'src/lib/components/workspace/user-timeline-island.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain(
        'openAuthorContext: (eventId: string, pubkey: string) => void;',
      );
      expect(source, file).not.toContain('openAuthorContext?:');
      expect(source, file).not.toContain('?? (() => {})');
    }
    const pane = readFileSync(
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      'utf8',
    );
    expect(pane).toContain('openAuthorContext,');
    expect(pane).toContain('mountUserTimelineIsland');
  });

  it('keeps Followees copy status explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/followees-island.ts',
      'utf8',
    );
    expect(source).toContain('setCopyStatus: (status: string) => void;');
    expect(source).toContain('copyUserRowNpub');
    expect(source).toContain('userRowCopyStatusText');
    expect(source).toContain('navigator.clipboard');
    expect(source).not.toContain('?? (() => {})');
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

  it('unmounts late island handles before accepting stale mounts', () => {
    for (const file of islandHosts) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('const current = generation;');
      expect(source, file).toContain(
        'if (generation !== current) {\n        next.unmount();\n        return;\n      }',
      );
      expect(source, file).toContain('if (generation === current) {');
    }
  });
});
