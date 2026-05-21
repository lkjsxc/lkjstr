<script lang="ts">
  import { onDestroy } from 'svelte';
  import { pointerDeltaToSplitRatio } from '$lib/workspace/resize';

  type Props = {
    direction: 'horizontal' | 'vertical';
    container: HTMLElement | undefined;
    resize: (deltaRatio: number) => void;
  };

  let { direction, container, resize }: Props = $props();
  let start = 0;
  let frame = 0;
  let pending = 0;
  let dragging = $state(false);

  function pointerDown(event: PointerEvent): void {
    event.preventDefault();
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    start = direction === 'horizontal' ? event.clientX : event.clientY;
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp, { once: true });
  }

  function pointerMove(event: PointerEvent): void {
    const current = direction === 'horizontal' ? event.clientX : event.clientY;
    const size =
      direction === 'horizontal'
        ? (container?.clientWidth ?? 0)
        : (container?.clientHeight ?? 0);
    pending += pointerDeltaToSplitRatio(current - start, size);
    start = current;
    if (!frame)
      frame = requestAnimationFrame(() => {
        const delta = pending;
        pending = 0;
        frame = 0;
        if (delta) resize(delta);
      });
  }

  function pointerUp(): void {
    dragging = false;
    window.removeEventListener('pointermove', pointerMove);
  }

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointermove', pointerMove);
    if (frame) cancelAnimationFrame(frame);
  });
</script>

<button
  type="button"
  class={`resize ${direction}`}
  class:active={dragging}
  aria-label="Resize panes"
  onpointerdown={pointerDown}
></button>
