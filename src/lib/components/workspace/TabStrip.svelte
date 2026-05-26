<script lang="ts">
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { WorkspaceTab } from '$lib/workspace/tab';
  import { readDraggedTab } from '$lib/workspace/tab-drag-payload';
  import {
    stripDragClear,
    stripDragPointerDown,
    type StripDragCtx,
    type StripDragDeps,
  } from '$lib/workspace/tab-strip-drag-handlers';
  import {
    revealTabInStrip,
    stripFadeState,
  } from '$lib/workspace/tab-strip-scroll';
  import { getContext, onDestroy, tick } from 'svelte';
  import {
    tabDragStateKey,
    type TabDragState,
  } from '$lib/workspace/tab-drag-state';
  import TabFrame from './TabFrame.svelte';

  type Props = {
    group: TabGroup;
    paneId: string;
    tabs: Record<string, WorkspaceTab>;
    focusTab: (tabId: string) => void;
    closeTab: (tabId: string) => void;
    disabled?: boolean;
    moveTab: StripDragDeps['moveTab'];
  };

  let {
    group,
    paneId,
    tabs,
    focusTab,
    closeTab,
    disabled = false,
    moveTab,
  }: Props = $props();
  const dragState = getContext<TabDragState | undefined>(tabDragStateKey);
  const prefersCoarse =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let drag = $state<StripDragCtx>({});
  let stripElement: HTMLElement | undefined;
  let fadeLeft = $state(false);
  let fadeRight = $state(false);
  const dragDeps: StripDragDeps = {
    paneId,
    tabCount: () => group.tabIds.length,
    moveTab,
    dragState,
  };

  function dropTab(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const dragged = readDraggedTab(event);
    if (!dragged) return;
    moveTab(dragged.sourcePaneId, paneId, dragged.tabId, targetIndex);
  }

  function pointerDown(event: PointerEvent, tab: WorkspaceTab): void {
    stripDragPointerDown(drag, dragDeps, event, tab.id, tab.title);
  }

  function updateFade(): void {
    const fade = stripFadeState(stripElement);
    fadeLeft = fade.left;
    fadeRight = fade.right;
  }

  $effect(() => {
    const activeId = group.activeTabId;
    const tabCount = group.tabIds.length;
    void tick().then(() => {
      if (activeId) revealTabInStrip(stripElement, activeId);
      if (tabCount >= 0) updateFade();
    });
  });

  onDestroy(() => stripDragClear(drag, dragDeps));
</script>

<div
  class="tab-strip-wrap"
  class:fade-left={fadeLeft}
  class:fade-right={fadeRight}
>
  <div
    bind:this={stripElement}
    class="tab-strip"
    role="tablist"
    tabindex="0"
    onscroll={updateFade}
    ondragover={(event) => event.preventDefault()}
    ondrop={(event) => dropTab(event, group.tabIds.length)}
  >
    {#each group.tabIds as tabId (tabId)}
      {@const tab = tabs[tabId]}
      {#if tab}
        <TabFrame
          {tab}
          {paneId}
          index={group.tabIds.indexOf(tab.id)}
          active={group.activeTabId === tab.id}
          dragging={drag.session?.snapshot.active === true &&
            drag.session.snapshot.tabId === tab.id}
          selectLocked={Boolean(
            drag.session &&
            (drag.session.longPressArmed || drag.session.snapshot.active) &&
            drag.session.snapshot.tabId === tab.id,
          )}
          nativeDraggable={drag.session
            ? drag.session.kind !== 'coarse'
            : !prefersCoarse}
          {disabled}
          focus={() => focusTab(tab.id)}
          close={() => closeTab(tab.id)}
          {pointerDown}
          {dropTab}
        />
      {/if}
    {/each}
  </div>
  {#if drag.session?.snapshot.active && drag.ghost}
    <div
      class="tab-drag-ghost"
      style={`left: ${drag.ghost.x}px; top: ${drag.ghost.y}px`}
    >
      {drag.ghost.title}
    </div>
  {/if}
</div>
