<script lang="ts">
  import type { Snippet } from 'svelte';
  import { VList } from 'virtua/svelte';
  import EventTreeListNearEnd from '$lib/components/events/EventTreeListNearEnd.svelte';
  import { isNearEnd } from '$lib/feed-surface/near-end';
  import type { OlderLoadTrigger } from '$lib/feed-surface/older-load-mode';

  export type FeedScrollListHandle = {
    getViewportSize?: () => number;
    getScrollSize?: () => number;
    getItemOffset?: (index: number) => number;
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
    onDownwardUserIntent?: () => void;
    list?: FeedScrollListHandle;
    scrollerElement?: HTMLDivElement;
    scrollElement?: HTMLElement;
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
    onDownwardUserIntent,
    list = $bindable(),
    scrollerElement = $bindable(),
    scrollElement = $bindable(),
    row,
  }: Props = $props();

  let viewportHeight = $derived(
    list?.getViewportSize?.() ?? scrollerElement?.clientHeight ?? 0,
  );
  let previousOffset = 0;
  let userScrollInput = false;

  function handleScroll(offset: number): void {
    onScrollOffset?.(offset);
    if (userScrollInput && offset > previousOffset) onDownwardUserIntent?.();
    previousOffset = offset;
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (nearEndEnabled && data.length > 0 && isNearEnd(offset, viewport, total))
      void onNearEnd?.('scroll');
  }

  function markWheelIntent(event: WheelEvent): void {
    if (event.deltaY > 0) userScrollInput = true;
  }

  function markKeyIntent(event: KeyboardEvent): void {
    if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key))
      userScrollInput = true;
  }

  function markTouchIntent(): void {
    userScrollInput = true;
  }

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
      <div class="feed-scroll-item">
        {@render row(item)}
      </div>
    {/snippet}
  </VList>
  <EventTreeListNearEnd
    enabled={nearEndEnabled}
    {viewportHeight}
    onNearEnd={() => onNearEnd?.('near-end')}
    scroller={scrollerElement}
  />
</div>
