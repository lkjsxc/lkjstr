<script lang="ts">
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { WorkspaceTab } from '$lib/workspace/tab';
  import {
    activatePointerDrag,
    pointerDropZone,
    pointerPaneAt,
    startPointerTabDrag,
    type PointerDragSnapshot,
  } from '$lib/workspace/pointer-tab-drag';

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
  let pointerDrag = $state<PointerDragSnapshot | undefined>();
  let ghost = $state<{ x: number; y: number; title: string } | undefined>();

  type DraggedTab = { sourcePaneId: string; tabId: string };

  function dragPayload(tabId: string): string {
    return JSON.stringify({ sourcePaneId: paneId, tabId });
  }

  function readDraggedTab(event: DragEvent): DraggedTab | undefined {
    const raw = event.dataTransfer?.getData('application/x-lkjstr-tab');
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Partial<DraggedTab>;
      if (typeof value.sourcePaneId !== 'string') return undefined;
      if (typeof value.tabId !== 'string') return undefined;
      return { sourcePaneId: value.sourcePaneId, tabId: value.tabId };
    } catch {
      return undefined;
    }
  }

  function dropTab(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const dragged = readDraggedTab(event);
    if (!dragged) return;
    moveTab(dragged.sourcePaneId, paneId, dragged.tabId, targetIndex);
  }

  function pointerDown(event: PointerEvent, tab: WorkspaceTab): void {
    if (event.button !== 0) return;
    pointerDrag = startPointerTabDrag(paneId, tab.id, event.clientX, event.clientY);
    ghost = { x: event.clientX, y: event.clientY, title: tab.title };
  }

  function pointerMove(event: PointerEvent): void {
    if (!pointerDrag) return;
    pointerDrag = activatePointerDrag(pointerDrag, event.clientX, event.clientY);
    if (!pointerDrag.active) return;
    event.preventDefault();
    document.body.classList.add('dragging-tab');
    ghost = { ...(ghost ?? { title: '' }), x: event.clientX, y: event.clientY };
  }

  function pointerUp(event: PointerEvent): void {
    if (!pointerDrag) return clearPointerDrag();
    if (!pointerDrag.active) return clearPointerDrag();
    const targetPane = pointerPaneAt(document, event.clientX, event.clientY);
    const targetPaneId = targetPane?.dataset.paneId;
    if (targetPane && targetPaneId) {
      const zone = pointerDropZone(
        targetPane.getBoundingClientRect(),
        event.clientX,
        event.clientY,
      );
      moveTab(
        pointerDrag.sourcePaneId,
        targetPaneId,
        pointerDrag.tabId,
        group.tabIds.length,
        zone === 'center' ? undefined : zone,
      );
    }
    clearPointerDrag();
  }

  function clearPointerDrag(): void {
    pointerDrag = undefined;
    ghost = undefined;
    document.body.classList.remove('dragging-tab');
  }
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
      <div
        role="tab"
        aria-label={tab.title}
        tabindex="-1"
        class:active={group.activeTabId === tab.id}
        class="tab-frame"
        draggable="true"
        ondragstart={(event) => {
          document.body.classList.add('dragging-tab');
          event.dataTransfer?.setData(
            'application/x-lkjstr-tab',
            dragPayload(tab.id),
          );
          event.dataTransfer?.setData('text/plain', tab.title);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }}
        ondragend={() => document.body.classList.remove('dragging-tab')}
        onpointerdown={(event) => pointerDown(event, tab)}
        onpointermove={pointerMove}
        onpointerup={pointerUp}
        onpointercancel={clearPointerDrag}
        ondragover={(event) => event.preventDefault()}
        ondrop={(event) => {
          event.stopPropagation();
          dropTab(event, group.tabIds.indexOf(tab.id));
        }}
      >
        <button
          type="button"
          class="tab-main"
          {disabled}
          onclick={() => focusTab(tab.id)}
        >
          <span>{tab.title}</span>
        </button>
        <button
          type="button"
          class="tab-close"
          aria-label={`Close ${tab.title}`}
          {disabled}
          onclick={(event) => {
            event.stopPropagation();
            closeTab(tab.id);
          }}
        >
          x
        </button>
      </div>
    {/if}
  {/each}
  {#if pointerDrag?.active && ghost}
    <div
      class="tab-drag-ghost"
      style={`left: ${ghost.x}px; top: ${ghost.y}px`}
    >
      {ghost.title}
    </div>
  {/if}
</div>
