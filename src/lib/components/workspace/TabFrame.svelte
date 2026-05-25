<script lang="ts">
  import { getContext } from 'svelte';
  import type { WorkspaceTab } from '$lib/workspace/tab';
  import {
    dragHasTabPayload,
    tabDragMime,
    tabDragPayload,
  } from '$lib/workspace/tab-drag-payload';
  import {
    tabDragStateKey,
    type TabDragState,
  } from '$lib/workspace/tab-drag-state';

  type Props = {
    tab: WorkspaceTab;
    paneId: string;
    index: number;
    active: boolean;
    dragging?: boolean;
    disabled: boolean;
    focus: () => void;
    close: () => void;
    pointerDown: (event: PointerEvent, tab: WorkspaceTab) => void;
    dropTab: (event: DragEvent, targetIndex: number) => void;
  };

  let props: Props = $props();
  const dragState = getContext<TabDragState | undefined>(tabDragStateKey);

  function dragStart(event: DragEvent): void {
    document.body.classList.add('dragging-tab');
    event.dataTransfer?.setData(
      tabDragMime,
      tabDragPayload(props.paneId, props.tab.id),
    );
    event.dataTransfer?.setData('text/plain', props.tab.title);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dragEnd(): void {
    dragState?.setTarget(undefined);
    document.body.classList.remove('dragging-tab');
  }

  function dragOver(event: DragEvent): void {
    if (!dragHasTabPayload(event)) return;
    event.preventDefault();
  }
</script>

<div
  role="tab"
  aria-label={props.tab.title}
  tabindex="-1"
  data-tab-id={props.tab.id}
  class:active={props.active}
  class:tab-frame--dragging={props.dragging}
  class="tab-frame"
  draggable="true"
  ondragstart={dragStart}
  ondragend={dragEnd}
  ondragover={dragOver}
  ondrop={(event) => {
    event.stopPropagation();
    props.dropTab(event, props.index);
  }}
>
  <button
    type="button"
    class="tab-main"
    disabled={props.disabled}
    onpointerdown={(event) => props.pointerDown(event, props.tab)}
    onclick={props.focus}
  >
    <span>{props.tab.title}</span>
  </button>
  <button
    type="button"
    class="tab-close"
    aria-label={`Close ${props.tab.title}`}
    disabled={props.disabled}
    onclick={(event) => {
      event.stopPropagation();
      props.close();
    }}
  >
    x
  </button>
</div>
