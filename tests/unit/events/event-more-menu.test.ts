import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  copyEventIdToClipboard,
  copyEventStatusLabel,
  eventMoreMenuHasAuthorContext,
} from '../../../src/lib/components/events/event-more-menu';

describe('event more menu clipboard', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copyEventIdToClipboard('event-id', clipboard);

    expect(clipboard.writes).toEqual(['event-id']);
    expect(status).toEqual({ kind: 'copied' });
    expect(copyEventStatusLabel(status)).toBe('Copied');
  });

  it('reports unavailable clipboard without claiming success', async () => {
    const status = await copyEventIdToClipboard('event-id', undefined);

    expect(status).toEqual({
      kind: 'failed',
      reason: 'Clipboard unavailable',
    });
    expect(copyEventStatusLabel(status)).toBe(
      'Copy failed: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming success', async () => {
    const status = await copyEventIdToClipboard('event-id', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({ kind: 'failed', reason: 'denied' });
    expect(copyEventStatusLabel(status)).toBe('Copy failed: denied');
  });
});

describe('event more menu author context action', () => {
  it('exposes nearby author action only when a callback exists', () => {
    expect(eventMoreMenuHasAuthorContext(undefined)).toBe(false);
    expect(eventMoreMenuHasAuthorContext(() => undefined)).toBe(true);
  });
});

describe('event more menu ownership', () => {
  it('keeps row components from importing the deleted Svelte menu', () => {
    for (const file of [
      'src/lib/components/events/EventRow.svelte',
      'src/lib/components/events/EventFragmentRow.svelte',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('EventMoreMenu.svelte');
      expect(source, file).not.toContain('<EventMoreMenu');
      expect(source, file).toContain('openAuthorContext=');
    }
  });

  it('keeps retained overflow behavior colocated with event metadata', () => {
    const source = readFileSync(
      'src/lib/components/events/EventMeta.svelte',
      'utf8',
    );
    expect(source).toContain('copyEventIdToClipboard');
    expect(source).toContain('Nearby posts by this author');
    expect(source).toContain('event-action-zone');
  });

  it('keeps shipped product files from mounting the deleted Svelte menu', () => {
    for (const file of productSourceFiles('src')) {
      const source = readFileSync(file, 'utf8');

      expect(source, file).not.toMatch(
        /EventMoreMenu\.svelte|import\s+EventMoreMenu|<EventMoreMenu(?:\s|>)/,
      );
    }
  });
});

function productSourceFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];
  for (const entry of entries) {
    const path = `${root}/${entry}`;
    if (path.includes('/node_modules/') || path.includes('/.svelte-kit/')) {
      continue;
    }
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...productSourceFiles(path));
      continue;
    }
    if (isProductSourceFile(path)) {
      files.push(path);
    }
  }
  return files;
}

function isProductSourceFile(path: string): boolean {
  return (
    path.endsWith('.svelte') ||
    path.endsWith('.ts') ||
    path.endsWith('.js')
  );
}
