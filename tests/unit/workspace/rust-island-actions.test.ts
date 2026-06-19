import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const islandHosts = ['src/lib/components/workspace/RustIslandHost.svelte'];

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

  it('keeps Search island snapshots explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/search-island.ts',
      'utf8',
    );
    expect(source).toContain('mount_search_tab');
    expect(source).toContain('registerTabRuntimeSnapshot');
    expect(source).toContain('filterState: { searchQuery: latestQuery }');
    expect(source).toContain('searchQueries.set(input.tabId, query)');
    expect(source).not.toContain('?? (() => {})');
  });

  it('keeps Global island actions explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/global-island.ts',
      'utf8',
    );
    expect(source).toContain('mount_global_tab');
    expect(source).toContain('openProfile: (pubkey: string) => void;');
    expect(source).toContain('openThread: (eventId: string) => void;');
    expect(source).toContain(
      'openAuthorContext: (eventId: string, pubkey: string) => void;',
    );
    expect(source).not.toContain('?? (() => {})');
  });

  it('keeps Home island actions explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/home-island.ts',
      'utf8',
    );
    const pane = readFileSync(
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      'utf8',
    );
    expect(source).toContain('mount_home_tab');
    expect(source).toContain('activePubkey?: string;');
    expect(source).toContain('openProfile: (pubkey: string) => void;');
    expect(source).toContain('openThread: (eventId: string) => void;');
    expect(source).toContain(
      'openAuthorContext: (eventId: string, pubkey: string) => void;',
    );
    expect(source).not.toContain('?? (() => {})');
    expect(pane).toContain('mountHomeIsland');
    expect(pane).not.toContain('TimelineTab');
  });

  it('keeps Notifications island actions explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/notifications-island.ts',
      'utf8',
    );
    const pane = readFileSync(
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      'utf8',
    );
    expect(source).toContain('mount_notifications_tab');
    expect(source).toContain('activePubkey?: string;');
    expect(source).toContain('openProfile: (pubkey: string) => void;');
    expect(source).toContain('openThread: (eventId: string) => void;');
    expect(source).toContain(
      'openAuthorContext: (eventId: string, pubkey: string) => void;',
    );
    expect(source).not.toContain('?? (() => {})');
    expect(pane).toContain('mountNotificationsIsland');
    expect(pane).not.toContain('NotificationsTab');
  });

  it('keeps Thread island actions explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/thread-island.ts',
      'utf8',
    );
    const pane = readFileSync(
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      'utf8',
    );
    expect(source).toContain('mount_thread_tab');
    expect(source).toContain('eventId: string;');
    expect(source).toContain('openProfile: (pubkey: string) => void;');
    expect(source).toContain('openThread: (eventId: string) => void;');
    expect(source).toContain(
      'openAuthorContext: (eventId: string, pubkey: string) => void;',
    );
    expect(source).not.toContain('?? (() => {})');
    expect(pane).toContain('mountThreadIsland');
    expect(pane).not.toContain('ThreadTab');
  });

  it('keeps Profile island actions explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/profile-island.ts',
      'utf8',
    );
    const pane = readFileSync(
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      'utf8',
    );
    expect(source).toContain('mount_profile_tab');
    expect(source).toContain('activePubkey?: string;');
    expect(source).toContain('openProfile: (pubkey: string) => void;');
    expect(source).toContain('openFollowees: (pubkey: string) => void;');
    expect(source).toContain('openUserTimeline: (pubkey: string) => void;');
    expect(source).toContain('openProfileEdit: () => void;');
    expect(source).toContain('openThread: (eventId: string) => void;');
    expect(source).toContain(
      'openAuthorContext: (eventId: string, pubkey: string) => void;',
    );
    expect(source).not.toContain('?? (() => {})');
    expect(pane).toContain('mountProfileIsland');
    expect(pane).not.toContain('ProfileTab');
  });

  it('keeps Custom Request island snapshots explicit in the typed mounter', () => {
    const source = readFileSync(
      'src/lib/components/workspace/custom-request-island.ts',
      'utf8',
    );
    expect(source).toContain('mount_custom_request_tab');
    expect(source).toContain('registerTabRuntimeSnapshot');
    expect(source).toContain('customRequestInput: latest.input');
    expect(source).toContain('customRequestRan: String(latest.ran)');
    expect(source).toContain('customRequestStates.set(input.tabId, latest)');
    expect(source).not.toContain('?? (() => {})');
  });

  it('cancels pending island mounts when hosts hide or destroy', () => {
    for (const file of islandHosts) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('function cancelIsland(): void');
      expect(source, file).toContain('generation += 1;');
      expect(source, file).toContain('if (!key) {\n      cancelIsland();');
      expect(source, file).toContain('onDestroy(() => {\n    cancelIsland();');
      expect(source, file).not.toContain('if (!key) {\n      releaseIsland();');
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
