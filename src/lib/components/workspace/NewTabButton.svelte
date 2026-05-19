<script lang="ts">
  type Props = {
    open: () => void;
    disabled?: boolean;
  };

  let { open, disabled = false }: Props = $props();
</script>

<button
  type="button"
  class="tile-icon-button"
  aria-label="Open new tab"
  {disabled}
  onclick={open}
>
  +
</button>
