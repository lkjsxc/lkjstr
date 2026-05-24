<script lang="ts">
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { WorkspaceTab } from '$lib/workspace/tab';
  import { readDraggedTab } from '$lib/workspace/tab-drag-payload';
  import {
    activatePointerDrag,
    pointerDragTarget,
    startPointerTabDrag,
    type PointerDragSnapshot,
  } from '$lib/workspace/pointer-tab-drag';
  import { tabDropEdge } from '$lib/workspace/tab-drop-zone';
  import { getContext, onDestroy } from 'svelte';
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
  let pointerDrag = $state<PointerDragSnapshot | undefined>();
  let ghost = $state<{ x: number; y: number; title: string } | undefined>();
  let dragElement: HTMLElement | undefined;

  function dropTab(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const dragged = readDraggedTab(event);
    if (!dragged) return;
    moveTab(dragged.sourcePaneId, paneId, dragged.tabId, targetIndex);
  }

  function pointerDown(event: PointerEvent, tab: WorkspaceTab): void {
    if (event.button !== 0) return;
    dragElement = event.currentTarget as HTMLElement;
    try {
      dragElement.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic pointer tests may not create a capturable pointer */
    }
    pointerDrag = startPointerTabDrag(
      paneId,
      tab.id,
      event.pointerId,
      event.clientX,
      event.clientY,
    );
    ghost = { x: event.clientX, y: event.clientY, title: tab.title };
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerCancel);
  }

  function pointerMove(event: PointerEvent): void {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
    pointerDrag = activatePointerDrag(
      pointerDrag,
      event.clientX,
      event.clientY,
    );
    if (!pointerDrag.active) return;
    event.preventDefault();
    document.body.classList.add('dragging-tab');
    pointerDrag = pointerDragTarget(document, pointerDrag);
    dragState?.setTarget(
      pointerDrag.targetPaneId && pointerDrag.zone
        ? { paneId: pointerDrag.targetPaneId, zone: pointerDrag.zone }
        : undefined,
    );
    ghost = { ...(ghost ?? { title: '' }), x: event.clientX, y: event.clientY };
  }

  function pointerUp(event: PointerEvent): void {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
    pointerDrag = pointerDragTarget(document, {
      ...pointerDrag,
      x: event.clientX,
      y: event.clientY,
    });
    if (pointerDrag.active && pointerDrag.targetPaneId && pointerDrag.zone)
      moveTab(
        pointerDrag.sourcePaneId,
        pointerDrag.targetPaneId,
        pointerDrag.tabId,
        pointerDrag.targetIndex ?? targetCount(pointerDrag.targetPaneId),
        tabDropEdge(pointerDrag.zone),
      );
    clearPointerDrag();
  }

  function pointerCancel(event: PointerEvent): void {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
    clearPointerDrag();
  }

  function clearPointerDrag(): void {
    if (pointerDrag) {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('pointerup', pointerUp);
        window.removeEventListener('pointercancel', pointerCancel);
      }
      if (dragElement?.hasPointerCapture(pointerDrag.pointerId))
        dragElement.releasePointerCapture(pointerDrag.pointerId);
    }
    pointerDrag = undefined;
    ghost = undefined;
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

  onDestroy(clearPointerDrag);
</script>

<div
  class="tab-strip"
  role="tablist"
  tabindex="0"
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
        {disabled}
        focus={() => focusTab(tab.id)}
        close={() => closeTab(tab.id)}
        {pointerDown}
        {dropTab}
      />
    {/if}
  {/each}
  {#if pointerDrag?.active && ghost}
    <div class="tab-drag-ghost" style={`left: ${ghost.x}px; top: ${ghost.y}px`}>
      {ghost.title}
    </div>
  {/if}
</div>
