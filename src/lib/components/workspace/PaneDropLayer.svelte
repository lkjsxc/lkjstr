<script lang="ts">
  import type { TabDropEdge } from '$lib/workspace/move-tab';

  type DraggedTab = { sourcePaneId: string; tabId: string };
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
  let edge = $state<TabDropEdge | 'center' | null>(null);

  function dragOver(event: DragEvent): void {
    if (props.disabled || !readDraggedTab(event)) return;
    event.preventDefault();
    edge = dropZone(event);
  }

  function drop(event: DragEvent): void {
    event.preventDefault();
    const dragged = readDraggedTab(event);
    if (!dragged || props.disabled) return;
    const zone = edge === 'center' ? undefined : (edge ?? undefined);
    props.moveTab(
      dragged.sourcePaneId,
      props.paneId,
      dragged.tabId,
      props.targetIndex,
      zone,
    );
    edge = null;
    document.body.classList.remove('dragging-tab');
  }

  function dropZone(event: DragEvent): TabDropEdge | 'center' {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const xLimit = threshold(rect.width);
    const yLimit = threshold(rect.height);
    if (x <= xLimit) return 'left';
    if (x >= rect.width - xLimit) return 'right';
    if (y <= yLimit) return 'top';
    if (y >= rect.height - yLimit) return 'bottom';
    return 'center';
  }

  function threshold(size: number): number {
    return Math.min(72, Math.max(32, size * 0.18));
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
</script>

<div
  role="presentation"
  class="pane-drop-layer"
  class:active={Boolean(edge)}
  data-drop-zone={edge}
  ondragover={dragOver}
  ondragleave={() => (edge = null)}
  ondrop={drop}
></div>
