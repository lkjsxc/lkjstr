import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'src/lib/components/feed/FeedMeasuredRow.svelte',
  'utf8',
);

describe('FeedMeasuredRow measurement source', () => {
  it('measures content height inside the reserved wrapper', () => {
    expect(source).toContain('let contentElement');
    expect(source).toContain('const contentNode = contentElement');
    expect(source).toContain('observer.observe(contentNode)');
    expect(source).toContain('bumpMeasurementGeneration()');
    expect(source).toContain('untrack(() => measurementGeneration) + 1');
    expect(source).not.toContain('measurementGeneration += 1');
    expect(source).toContain('class="feed-scroll-item__content"');
    expect(source).toContain('style={`min-height: ${reservedHeight}px;`}');
  });
});
