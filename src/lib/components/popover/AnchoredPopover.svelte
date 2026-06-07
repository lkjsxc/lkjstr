<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { computeAnchoredPosition, type PopoverPlacement } from './position';
  import { mountPopoverPortal } from './popover-portal';

  type Props = {
    anchor: HTMLElement;
    label: string;
    preferred?: PopoverPlacement;
    close: () => void;
    children: import('svelte').Snippet;
  };

  let {
    anchor,
    label,
    preferred = 'bottom-end',
    close,
    children,
  }: Props = $props();
  let popover: HTMLElement;
  let top = $state(0);
  let left = $state(0);
  let positioned = $state(false);
  let destroyed = false;

  async function update(): Promise<void> {
    await tick();
    if (destroyed || !anchor || !popover) return;
    const rect = anchor.getBoundingClientRect();
    const box = popover.getBoundingClientRect();
    const tile =
      anchor.closest('[data-pane-id]')?.querySelector('.pane-stack') ??
      anchor.closest('[data-pane-id]');
    const bounds = tile?.getBoundingClientRect();
    const next = computeAnchoredPosition({
      anchor: rect,
      popover: { width: box.width, height: box.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bounds,
      preferred,
      gap: 6,
    });
    top = next.top;
    left = next.left;
    positioned = true;
  }

  onMount(() => {
    const releasePortal = mountPopoverPortal(anchor, popover);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popover.contains(target) && !anchor.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    void update();
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            void update();
          });
    resizeObserver?.observe(popover);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      destroyed = true;
      resizeObserver?.disconnect();
      releasePortal();
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  });
</script>

<div
  bind:this={popover}
  class="anchored-popover"
  class:anchored-popover--positioned={positioned}
  style={`top: ${top}px; left: ${left}px`}
  aria-label={label}
>
  {@render children()}
</div>
