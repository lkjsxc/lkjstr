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

  function keydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.08 : 0.03;
    const negative =
      (direction === 'horizontal' && event.key === 'ArrowLeft') ||
      (direction === 'vertical' && event.key === 'ArrowUp');
    const positive =
      (direction === 'horizontal' && event.key === 'ArrowRight') ||
      (direction === 'vertical' && event.key === 'ArrowDown');
    if (!negative && !positive) return;
    event.preventDefault();
    resize(negative ? -step : step);
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
  onkeydown={keydown}
></button>
