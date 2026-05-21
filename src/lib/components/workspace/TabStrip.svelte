<script lang="ts">
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { WorkspaceTab } from '$lib/workspace/tab';

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
          {#if tab.unreadCount}
            <small>{tab.unreadCount}</small>
          {/if}
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
</div>
