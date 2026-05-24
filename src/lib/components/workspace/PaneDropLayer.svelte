<script lang="ts">
  import { getContext, onDestroy, tick } from 'svelte';
  import type { TabDropEdge } from '$lib/workspace/move-tab';
  import {
    tabDropEdge,
    tabDropOverlayStyle,
    tabDropZone,
    type TabDropZone,
  } from '$lib/workspace/tab-drop-zone';
  import {
    dragHasTabPayload,
    readDraggedTab,
  } from '$lib/workspace/tab-drag-payload';
  import {
    tabDragStateKey,
    type TabDragState,
    type TabDragTarget,
  } from '$lib/workspace/tab-drag-state';

  type Props = {
    paneId: string;
    targetIndex: number;
    disabled?: boolean;
    moveTab: (
      sourcePaneId: string,
      targetPaneId: string,
      tabId: string,
      targetIndex: number,
      edge?: TabDropEdge,
    ) => void;
  };

  let props: Props = $props();
  const dragState = getContext<TabDragState | undefined>(tabDragStateKey);
  let nativeZone = $state<TabDropZone | null>(null);
  let pointerTarget = $state<TabDragTarget | undefined>();
  let layer: HTMLElement | undefined;
  let style = $state('');
  const unsubscribe = dragState?.target.subscribe(
    (target) => (pointerTarget = target),
  );
  let zone = $derived(
    nativeZone ??
      (pointerTarget?.paneId === props.paneId ? pointerTarget.zone : null),
  );

  function dragOver(event: DragEvent): void {
    if (props.disabled || !dragHasTabPayload(event)) return;
    event.preventDefault();
    nativeZone = tabDropZone(
      (event.currentTarget as HTMLElement).getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );
    dragState?.setTarget({ paneId: props.paneId, zone: nativeZone });
  }

  function drop(event: DragEvent): void {
    event.preventDefault();
    const dragged = readDraggedTab(event);
    if (!dragged || props.disabled) return;
    props.moveTab(
      dragged.sourcePaneId,
      props.paneId,
      dragged.tabId,
      props.targetIndex,
      tabDropEdge(zone),
    );
    clearDrag();
  }

  function clearDrag(): void {
    nativeZone = null;
    dragState?.setTarget(undefined);
    document.body.classList.remove('dragging-tab');
  }

  function dragLeave(): void {
    nativeZone = null;
    if (pointerTarget?.paneId === props.paneId) dragState?.setTarget(undefined);
  }

  $effect(() => {
    const active = zone;
    if (!active || !layer) {
      style = '';
      return;
    }
    void tick().then(() => {
      if (!layer || zone !== active) return;
      style = tabDropOverlayStyle(layer.getBoundingClientRect(), active);
    });
  });

  onDestroy(() => unsubscribe?.());
</script>

<div
  bind:this={layer}
  role="presentation"
  class="pane-drop-layer"
  class:active={Boolean(zone)}
  data-drop-zone={zone}
  {style}
  ondragover={dragOver}
  ondragleave={dragLeave}
  ondrop={drop}
></div>
