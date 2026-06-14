import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('user timeline scroll flow', () => {
  it('mounts the Rust island from Svelte host glue', () => {
    const pane = readFileSync(
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      'utf8',
    );
    const host = readFileSync(
      'src/lib/components/workspace/RustIslandHost.svelte',
      'utf8',
    );
    const mounter = readFileSync(
      'src/lib/components/workspace/user-timeline-island.ts',
      'utf8',
    );

    expect(pane).toContain('mountUserTimelineIsland');
    expect(host).toContain('releaseIsland');
    expect(mounter).toContain('loadLkjstrWebWasm');
    expect(mounter).toContain('mount_user_timeline_tab');
    expect(pane).not.toContain('runUserTimelineRuntime');
  });
});
