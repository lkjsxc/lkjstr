import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const tabDir = 'src/lib/tabs';
const formShell = readFileSync(
  'src/lib/components/workspace/FormTabShell.svelte',
  'utf8',
);

function tabFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(tabDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(tabDir, entry.name);
    for (const child of readdirSync(path)) {
      if (child.endsWith('Tab.svelte')) files.push(join(path, child));
    }
  }
  return files.sort();
}

function sectionClass(source: string): string | undefined {
  const match = source.match(/<section[^>]*class="([^"]+)"/);
  return match?.[1];
}

describe('tab shell classes', () => {
  it('keeps form-tab on the shared form shell root', () => {
    expect(formShell).toContain('class="form-tab');
    expect(formShell).toContain('form-tab__scroll');
    expect(formShell).toContain('data-scroll-owner');
  });

  it('routes every tool tab through FormTabShell', () => {
    const feedOnly = new Set([
      'timeline/TimelineTab.svelte',
      'profile/ProfileTab.svelte',
      'notifications/NotificationsTab.svelte',
      'thread/ThreadTab.svelte',
      'search/SearchTab.svelte',
      'followees/FolloweesTab.svelte',
      'user-timeline/UserTimelineTab.svelte',
    ]);
    const hybrid = new Set([
      'custom-request/CustomRequestTab.svelte',
      'author-context/AuthorContextTab.svelte',
    ]);

    for (const file of tabFiles()) {
      const rel = file.replace(`${tabDir}/`, '');
      const source = readFileSync(file, 'utf8');
      if (feedOnly.has(rel)) {
        const classes = sectionClass(source) ?? '';
        expect(classes, rel).toContain('feed-tab');
        expect(classes, rel).not.toContain('form-tab');
        expect(source, rel).not.toContain('FormTabShell');
        continue;
      }
      if (hybrid.has(rel)) {
        const classes = sectionClass(source) ?? '';
        expect(classes, rel).toContain('hybrid-tab');
        expect(classes, rel).toContain('feed-tab');
        continue;
      }
      expect(source, rel).toContain('FormTabShell');
    }
  });
});
