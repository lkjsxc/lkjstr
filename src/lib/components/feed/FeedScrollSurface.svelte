<script lang="ts">
  import type { Snippet } from 'svelte';
  import { VList } from 'virtua/svelte';
  import EventTreeListNearEnd from '$lib/components/events/EventTreeListNearEnd.svelte';
  import FeedMeasuredRow from './FeedMeasuredRow.svelte';
  import { isNearEnd } from '$lib/feed-surface/near-end';
  import type { OlderLoadTrigger } from '$lib/feed-surface/older-load-mode';
  import {
    consumeDownwardScrollIntent,
    createFeedScrollIntent,
    markDownwardScrollInput,
  } from '$lib/feed-surface/scroll-intent';

  export type FeedScrollListHandle = {
    getViewportSize?: () => number;
    getScrollSize?: () => number;
    getItemOffset?: (index: number) => number;
    getScrollOffset?: () => number;
    scrollTo?: (offset: number) => void;
    scrollToIndex?: (index: number) => void;
  };

  type Props = {
    data: readonly unknown[];
    getKey: (item: unknown) => string;
    viewportClass: string;
    scrollerClass: string;
    nearEndEnabled?: boolean;
    onNearEnd?: (trigger: OlderLoadTrigger) => void | Promise<void>;
    onScrollOffset?: (offset: number) => void;
    list?: FeedScrollListHandle;
    scrollerElement?: HTMLDivElement;
    scrollElement?: HTMLElement;
    intentKey?: string;
    row: Snippet<[item: unknown]>;
  };

  let {
    data,
    getKey,
    viewportClass,
    scrollerClass,
    nearEndEnabled = false,
    onNearEnd,
    onScrollOffset,
    list = $bindable(),
    scrollerElement = $bindable(),
    scrollElement = $bindable(),
    intentKey,
    row,
  }: Props = $props();

  let viewportHeight = $derived(
    list?.getViewportSize?.() ?? scrollerElement?.clientHeight ?? 0,
  );
  let scrollIntent = createFeedScrollIntent();
  let previousIntentKey: string | undefined;
  let previousIntentOwner: HTMLElement | undefined;
  let hasIntentBaseline = false;

  function handleScroll(offset: number): void {
    onScrollOffset?.(offset);
    const consumed = consumeDownwardScrollIntent(scrollIntent, offset);
    scrollIntent = consumed.intent;
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (
      consumed.userScrolledDown &&
      nearEndEnabled &&
      data.length > 0 &&
      isNearEnd(offset, viewport, total)
    )
      void onNearEnd?.('scroll');
  }

  function markWheelIntent(event: WheelEvent): void {
    if (event.deltaY > 0) scrollIntent = markDownwardScrollInput(scrollIntent);
  }

  function markKeyIntent(event: KeyboardEvent): void {
    if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key))
      scrollIntent = markDownwardScrollInput(scrollIntent);
  }

  function markTouchIntent(): void {
    scrollIntent = markDownwardScrollInput(scrollIntent);
  }

  $effect(() => {
    if (
      hasIntentBaseline &&
      previousIntentKey === intentKey &&
      previousIntentOwner === scrollElement
    )
      return;
    hasIntentBaseline = true;
    previousIntentKey = intentKey;
    previousIntentOwner = scrollElement;
    scrollIntent = createFeedScrollIntent(scrollElement?.scrollTop ?? 0);
  });

  $effect(() => {
    if (!scrollerElement) return;
    scrollElement =
      scrollerElement.querySelector<HTMLElement>('[data-scroll-owner]') ??
      scrollerElement;
  });

  $effect(() => {
    if (!scrollElement) return;
    const target = scrollElement;
    target.addEventListener('wheel', markWheelIntent);
    target.addEventListener('keydown', markKeyIntent);
    target.addEventListener('touchmove', markTouchIntent);
    return () => {
      target.removeEventListener('wheel', markWheelIntent);
      target.removeEventListener('keydown', markKeyIntent);
      target.removeEventListener('touchmove', markTouchIntent);
    };
  });
</script>

<div class={scrollerClass} bind:this={scrollerElement}>
  <VList
    bind:this={list}
    class={viewportClass}
    {...{ 'data-scroll-owner': '' }}
    {data}
    style="height: 100%; min-height: 0;"
    {getKey}
    onscroll={handleScroll}
  >
    {#snippet children(item)}
      <FeedMeasuredRow {item} {getKey} {scrollElement} {row} />
    {/snippet}
  </VList>
  <EventTreeListNearEnd
    enabled={nearEndEnabled}
    {viewportHeight}
    onNearEnd={() => onNearEnd?.('near-end')}
    scroller={scrollerElement}
  />
</div>
