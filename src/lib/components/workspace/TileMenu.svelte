<script lang="ts">
  type Props = {
    split: (direction: 'horizontal' | 'vertical') => void;
    closePane: () => void;
  };

  let props: Props = $props();
  let open = $state(false);
  let root: HTMLElement;

  $effect(() => {
    if (!open) return;
    function closeOnPointerDown(event: PointerEvent): void {
      if (!root.contains(event.target as Node)) open = false;
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') open = false;
    }
    document.addEventListener('pointerdown', closeOnPointerDown, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  });

  function run(action: () => void): void {
    open = false;
    action();
  }
</script>

<div class="tile-menu" bind:this={root}>
  <button
    type="button"
    class="tile-menu-trigger"
    aria-label={open ? 'Close tile menu' : 'Open tile menu'}
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    ...
  </button>
  {#if open}
    <div class="tile-menu-popover" aria-label="Tile actions">
      <button
        type="button"
        onclick={() => run(() => props.split('horizontal'))}
      >
        Split right
      </button>
      <button type="button" onclick={() => run(() => props.split('vertical'))}>
        Split down
      </button>
      <button type="button" onclick={() => run(props.closePane)}>
        Tile close
      </button>
    </div>
  {/if}
</div>
