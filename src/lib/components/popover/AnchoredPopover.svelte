<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { computeAnchoredPosition, type PopoverPlacement } from './position';

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

  async function update(): Promise<void> {
    await tick();
    if (!anchor || !popover) return;
    const rect = anchor.getBoundingClientRect();
    const box = popover.getBoundingClientRect();
    const next = computeAnchoredPosition({
      anchor: rect,
      popover: { width: box.width, height: box.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      preferred,
      gap: 6,
    });
    top = next.top;
    left = next.left;
  }

  onMount(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popover.contains(target) && !anchor.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    update();
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
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
  style={`top: ${top}px; left: ${left}px`}
  aria-label={label}
>
  {@render children()}
</div>
