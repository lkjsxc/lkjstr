<script lang="ts">
  import { getContext, onDestroy, tick } from 'svelte';
  import type { TabDropEdge } from '$lib/workspace/move-tab';
  import {
    paneDropRects,
    resolvePaneDrop,
  } from '$lib/workspace/pane-drop-resolve';
  import {
    tabDropEdge,
    tabDropOverlayStyle,
  } from '$lib/workspace/tab-drop-zone';
  import { paneBodyOffsetTop } from '$lib/workspace/tab-drop-preview';
  import type { TabDropZone } from '$lib/workspace/tab-drop-hit';
  import {
    dragHasTabPayload,
    readDraggedTab,
  } from '$lib/workspace/tab-drag-payload';
  import type { TabInsertionFrame } from '$lib/workspace/pointer-tab-drag';
  import {
    tabDragStateKey,
    type TabDragState,
    type TabDragTarget,
  } from '$lib/workspace/tab-drag-state';

  type Props = {
    paneId: string;
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
  let nativeIndex = $state(0);
  let pointerTarget = $state<TabDragTarget | undefined>();
  let paneRoot: HTMLElement | undefined;
  let style = $state('');
  const unsubscribe = dragState?.target.subscribe(
    (target) => (pointerTarget = target),
  );
  let zone = $derived(
    nativeZone ??
      (pointerTarget?.paneId === props.paneId ? pointerTarget.zone : null),
  );

  function paneElement(): HTMLElement | undefined {
    return paneRoot?.closest<HTMLElement>('[data-pane-id]') ?? paneRoot;
  }

  function dragOver(event: DragEvent): void {
    if (props.disabled || !dragHasTabPayload(event)) return;
    event.preventDefault();
    const dragged = readDraggedTab(event);
    const pane = paneElement();
    if (!pane || !dragged) return;
    const { paneRect, bodyRect, chromeBottom, stripBottom } =
      paneDropRects(pane);
    const frames = tabFrames(pane);
    const resolved = resolvePaneDrop({
      paneRect,
      bodyRect,
      chromeBottom,
      stripBottom,
      clientX: event.clientX,
      clientY: event.clientY,
      sourcePaneId: dragged.sourcePaneId,
      targetPaneId: props.paneId,
      draggedTabId: dragged.tabId,
      frames,
    });
    nativeZone = resolved.zone;
    nativeIndex = resolved.targetIndex;
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
      nativeIndex,
      tabDropEdge(zone),
    );
    clearDrag();
  }

  function clearDrag(): void {
    nativeZone = null;
    nativeIndex = 0;
    dragState?.setTarget(undefined);
    if (typeof document !== 'undefined')
      document.body.classList.remove('dragging-tab');
  }

  function dragLeave(): void {
    nativeZone = null;
    if (pointerTarget?.paneId === props.paneId) dragState?.setTarget(undefined);
  }

  function tabFrames(pane: HTMLElement): readonly TabInsertionFrame[] {
    return [
      ...pane.querySelectorAll<HTMLElement>('.tab-frame[data-tab-id]'),
    ].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tabId: element.dataset.tabId ?? '',
        left: rect.left,
        width: rect.width,
      };
    });
  }

  $effect(() => {
    const active = zone;
    const pane = paneElement();
    if (!active || !pane) {
      style = '';
      return;
    }
    void tick().then(() => {
      if (!pane || zone !== active) return;
      const { paneRect, bodyRect } = paneDropRects(pane);
      const bodyOffsetTop = paneBodyOffsetTop(paneRect, bodyRect);
      const overlayRect = {
        width: bodyRect.width,
        height: bodyRect.height,
      };
      style = tabDropOverlayStyle(overlayRect, active, bodyOffsetTop);
    });
  });

  onDestroy(() => unsubscribe?.());
</script>

<div
  bind:this={paneRoot}
  role="presentation"
  class="pane-drop-layer"
  class:active={Boolean(zone)}
  data-drop-zone={zone}
  {style}
  ondragover={dragOver}
  ondragleave={dragLeave}
  ondrop={drop}
></div>
