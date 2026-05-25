<script lang="ts">
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { WorkspaceTab } from '$lib/workspace/tab';
  import { readDraggedTab } from '$lib/workspace/tab-drag-payload';
  import { tabDropEdge } from '$lib/workspace/tab-drop-zone';
  import {
    clearStripTimer,
    moveStripPointer,
    startStripPointer,
    type StripPointerSession,
  } from '$lib/workspace/tab-strip-pointer';
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
    moveTab: (
      sourcePaneId: string,
      targetPaneId: string,
      tabId: string,
      targetIndex: number,
      edge?: 'left' | 'right' | 'top' | 'bottom',
    ) => void;
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
  let session = $state<StripPointerSession | undefined>();
  let ghost = $state<{ x: number; y: number; title: string } | undefined>();
  let dragElement: HTMLElement | undefined;
  let stripElement: HTMLElement | undefined;
  let fadeLeft = $state(false);
  let fadeRight = $state(false);

  function dropTab(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const dragged = readDraggedTab(event);
    if (!dragged) return;
    moveTab(dragged.sourcePaneId, paneId, dragged.tabId, targetIndex);
  }

  function pointerDown(event: PointerEvent, tab: WorkspaceTab): void {
    if (event.button !== 0) return;
    dragElement = event.currentTarget as HTMLElement;
    session = startStripPointer(paneId, tab.id, event);
    ghost = { x: event.clientX, y: event.clientY, title: tab.title };
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerCancel);
  }

  function pointerMove(event: PointerEvent): void {
    if (!session || event.pointerId !== session.snapshot.pointerId) return;
    session = moveStripPointer(session, event);
    if (!session.snapshot.active) return;
    event.preventDefault();
    dragElement?.classList.add('tab-frame--dragging');
    document.body.classList.add('dragging-tab');
    dragState?.setTarget(
      session.snapshot.targetPaneId && session.snapshot.zone
        ? { paneId: session.snapshot.targetPaneId, zone: session.snapshot.zone }
        : undefined,
    );
    ghost = { ...(ghost ?? { title: '' }), x: event.clientX, y: event.clientY };
  }

  function pointerUp(event: PointerEvent): void {
    if (!session || event.pointerId !== session.snapshot.pointerId) return;
    session = moveStripPointer(session, event);
    const snap = session.snapshot;
    if (snap.active && snap.targetPaneId && snap.zone)
      moveTab(
        snap.sourcePaneId,
        snap.targetPaneId,
        snap.tabId,
        snap.targetIndex ?? targetCount(snap.targetPaneId),
        tabDropEdge(snap.zone),
      );
    clearPointerDrag();
  }

  function pointerCancel(event: PointerEvent): void {
    if (!session || event.pointerId !== session.snapshot.pointerId) return;
    clearPointerDrag();
  }

  function clearPointerDrag(): void {
    if (session) {
      clearStripTimer(session);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('pointerup', pointerUp);
        window.removeEventListener('pointercancel', pointerCancel);
        if (dragElement?.hasPointerCapture(session.snapshot.pointerId)) {
          try {
            dragElement.releasePointerCapture(session.snapshot.pointerId);
          } catch {
            /* synthetic pointer tests may not support capture release */
          }
        }
      }
    }
    session = undefined;
    ghost = undefined;
    dragElement?.classList.remove('tab-frame--dragging');
    dragElement = undefined;
    dragState?.setTarget(undefined);
    if (typeof document !== 'undefined')
      document.body.classList.remove('dragging-tab');
  }

  function targetCount(targetPaneId: string): number {
    return targetPaneId === paneId
      ? group.tabIds.length
      : Number(
          document
            .querySelector(`[data-pane-id="${targetPaneId}"]`)
            ?.getAttribute('data-tab-count') ?? 0,
        );
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

  onDestroy(clearPointerDrag);
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
          dragging={session?.snapshot.active === true &&
            session.snapshot.tabId === tab.id}
          {disabled}
          focus={() => focusTab(tab.id)}
          close={() => closeTab(tab.id)}
          {pointerDown}
          {dropTab}
        />
      {/if}
    {/each}
  </div>
  {#if session?.snapshot.active && ghost}
    <div class="tab-drag-ghost" style={`left: ${ghost.x}px; top: ${ghost.y}px`}>
      {ghost.title}
    </div>
  {/if}
</div>
