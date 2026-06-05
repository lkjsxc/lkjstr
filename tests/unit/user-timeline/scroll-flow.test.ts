import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('user timeline scroll flow', () => {
  it('renders header and notices as feed leading rows', () => {
    const source = readFileSync(
      'src/lib/tabs/user-timeline/UserTimelineTab.svelte',
      'utf8',
    );

    expect(source).toContain('let leadingRows = $derived');
    expect(source).toContain('{#snippet leadingRow(row)}');
    expect(source.indexOf('<EventTreeList')).toBeLessThan(
      source.indexOf('user-timeline-tab__header'),
    );
  });
});
