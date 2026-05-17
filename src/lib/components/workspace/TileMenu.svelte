<script lang="ts">
  import AnchoredPopover from '$lib/components/popover/AnchoredPopover.svelte';

  type Props = {
    split: (direction: 'horizontal' | 'vertical') => void;
    closePane: () => void;
  };

  let props: Props = $props();
  let open = $state(false);
  let trigger: HTMLElement = $state() as HTMLElement;

  function run(action: () => void): void {
    open = false;
    action();
  }
</script>

<div class="tile-menu">
  <button
    bind:this={trigger}
    type="button"
    class="tile-icon-button"
    aria-label={open ? 'Close tile menu' : 'Open tile menu'}
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    ...
  </button>
  {#if open}
    <AnchoredPopover
      anchor={trigger}
      label="Tile actions"
      close={() => (open = false)}
    >
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
    </AnchoredPopover>
  {/if}
</div>
