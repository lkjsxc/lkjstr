<script lang="ts">
  type Props = {
    open: () => void;
  };

  let { open }: Props = $props();
</script>

<button
  type="button"
  class="tile-icon-button"
  aria-label="Open new tab"
  onclick={open}
>
  +
</button>
