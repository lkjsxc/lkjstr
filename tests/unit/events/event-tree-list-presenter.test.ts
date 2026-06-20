import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const treeList = readFileSync(
  'src/lib/components/events/EventTreeList.svelte',
  'utf8',
);
const treeSurface = readFileSync(
  'src/lib/components/events/EventTreeListSurface.svelte',
  'utf8',
);
const treeRows = readFileSync(
  'src/lib/components/events/EventTreeListRows.svelte',
  'utf8',
);
const nearEnd = readFileSync(
  'src/lib/components/events/EventTreeListNearEnd.svelte',
  'utf8',
);
const scrollSurface = readFileSync(
  'src/lib/components/feed/FeedScrollSurface.svelte',
  'utf8',
);

describe('event tree list presenter wiring', () => {
  it('routes retained tree cache, row building, and anchor rows through helpers', () => {
    expect(treeList).toContain('treeNodesFromItems(props.items, treeCache)');
    expect(treeList).toContain('eventNodeKey');
    expect(treeList).toContain('buildViewRows(props.leadingRows ?? [], nodes');
    expect(treeList).toContain('eventRows(rows)');
    expect(treeList).toContain('captureAndStoreFeedListAnchor({');
    expect(treeList).toContain('restoreFeedListAnchor({');
    expect(treeList).toContain('syncFeedListAnchor({');
    expect(treeList).toContain('nearVisibleEventIds(rows, list, scrollOffset)');
    expect(treeList).toContain('fallbackNodeIds(nodes)');
  });

  it('keeps paging, auto-fill, and newer checks on focused plans', () => {
    expect(treeList).toContain('eventTreeListNearEndEnabled({');
    expect(treeList).toContain('isRowNearStart(rows, offset');
    expect(treeList).toContain('shouldRequestEventTreeListNewer({');
    expect(treeList).toContain('shouldScheduleEventTreeListNewerCheck({');
    expect(treeList).toContain('eventTreeListAutoFillIntentState({');
    expect(treeList).toContain('canAttemptEventTreeListAutoFill({');
    expect(treeList).toContain('shouldPrefetchEventTreeListOlder({');
    expect(treeList).toContain('canRequestEventTreeListOlder({');
    expect(treeList).toContain("await requestOlder('viewport-fill')");
    expect(treeList).toContain('await props.onNearEnd?.(trigger)');
  });

  it('keeps the scroll surface keyed by helper rows and delegates row rendering', () => {
    expect(treeSurface).toContain(
      'getKey={(item: unknown) => viewRowKey(item as EventTreeListViewRow)}',
    );
    expect(treeSurface).toContain('onNearEnd={requestOlder}');
    expect(treeSurface).toContain('onScrollOffset={handleScrollOffset}');
    expect(treeSurface).toContain('<EventTreeListRows');
    expect(treeSurface).toContain('node={node as EventTreeListViewRow}');
    expect(treeSurface).toContain('leadingRow={props.leadingRow}');
  });

  it('keeps retained row data and continuations on row plans', () => {
    expect(treeRows).toContain('eventTreeListRowData({');
    expect(treeRows).toContain('eventTreeListRowRenderPlan({');
    expect(treeRows).toContain(
      'continuationPlanForViewRow(props.node, props.openThread)',
    );
    expect(treeRows).toContain(
      'openContinuationThread(render.continuation, props.openThread)',
    );
    expect(treeRows).toContain("{#if render.kind === 'leading'}");
    expect(treeRows).toContain("{:else if render.kind === 'continuation'}");
    expect(treeRows).toContain("{:else if render.kind === 'eventFragment'}");
    expect(treeRows).toContain("{:else if render.kind === 'event'}");
    expect(treeRows).toContain('{#if render.continuation.canOpenThread}');
    expect(treeRows).toContain('{render.continuation.buttonText}');
    expect(treeRows).toContain('{render.continuation.unavailableText}');
    expect(treeRows).toContain('<EventFragmentRow');
    expect(treeRows).toContain('<EventRow');
  });

  it('keeps near-end sentinel behavior on local observer plans', () => {
    expect(nearEnd).toContain('planEventTreeListNearEnd(props)');
    expect(nearEnd).toContain('createEventTreeListNearEndSentinel({');
    expect(nearEnd).toContain('rootMargin: () => plan.rootMargin');
    expect(nearEnd).toContain('enabled: () => plan.enabled');
    expect(nearEnd).toContain('nearEndSentinel.observe();');
    expect(scrollSurface).toContain('<EventTreeListNearEnd');
    expect(scrollSurface).toContain("void onNearEnd?.('scroll')");
    expect(scrollSurface).toContain(
      "onNearEnd={() => onNearEnd?.('near-end')}",
    );
  });
});
