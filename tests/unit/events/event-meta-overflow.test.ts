import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  copyEventMetaEventId,
  eventMetaHasAuthorContext,
  eventMetaOverflowLabels,
  openEventMetaAuthorContext,
  stopEventMetaOverflowPropagation,
} from '../../../src/lib/components/events/event-meta-overflow';

describe('event meta overflow clipboard', () => {
  it('keeps copy action local before writing event ids', async () => {
    const calls: string[] = [];
    const status = await copyEventMetaEventId(
      { stopPropagation: () => calls.push('stop') },
      'event-id',
      {
        writeText: async (value) => {
          calls.push(`write:${value}`);
        },
      },
    );

    expect(status).toEqual({ kind: 'copied' });
    expect(calls).toEqual(['stop', 'write:event-id']);
  });
});

describe('event meta overflow author context action', () => {
  it('exposes nearby author action only when a callback exists', () => {
    expect(eventMetaHasAuthorContext(undefined)).toBe(false);
    expect(eventMetaHasAuthorContext(() => undefined)).toBe(true);
  });

  it('opens nearby author context without bubbling into the row', () => {
    let stopped = 0;
    const opened: string[] = [];
    const event = { stopPropagation: () => (stopped += 1) };

    expect(
      openEventMetaAuthorContext(
        event,
        (eventId, pubkey) => opened.push(`${eventId}:${pubkey}`),
        'event-a',
        'pubkey-a',
      ),
    ).toBe(true);
    expect(
      openEventMetaAuthorContext(event, undefined, 'event-b', 'pubkey-b'),
    ).toBe(false);

    expect(stopped).toBe(2);
    expect(opened).toEqual(['event-a:pubkey-a']);
  });
});

describe('event meta overflow propagation', () => {
  it('keeps menu interactions local to the metadata overflow', () => {
    let stopped = 0;

    stopEventMetaOverflowPropagation({
      stopPropagation: () => (stopped += 1),
    });

    expect(stopped).toBe(1);
  });
});

describe('event meta overflow labels', () => {
  it('plans retained menu and action labels', () => {
    expect(eventMetaOverflowLabels()).toEqual({
      copyEventId: 'Copy event ID',
      menu: 'Event menu',
      nearbyAuthor: 'Nearby posts by this author',
    });
  });
});

describe('event meta overflow ownership', () => {
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
    expect(source).toContain('copyEventMetaEventId');
    expect(source).toContain('eventMetaOverflowLabels');
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
    path.endsWith('.svelte') || path.endsWith('.ts') || path.endsWith('.js')
  );
}
