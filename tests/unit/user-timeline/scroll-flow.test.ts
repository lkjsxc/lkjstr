import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('user timeline scroll flow', () => {
  it('mounts the Rust island from Svelte host glue', () => {
    const source = readFileSync(
      'src/lib/tabs/user-timeline/UserTimelineTab.svelte',
      'utf8',
    );

    expect(source).toContain('loadLkjstrWebWasm');
    expect(source).toContain('mount_user_timeline_tab');
    expect(source).toContain('releaseIsland');
    expect(source).not.toContain('runUserTimelineRuntime');
  });
});
