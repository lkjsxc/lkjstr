<script lang="ts">
  type Props = {
    openUploadSettings: () => void;
  };

  let props: Props = $props();
</script>

<button
  type="button"
  class="upload-gate-hint"
  onclick={props.openUploadSettings}
>
  Configure media upload in Upload Settings.
</button>

<style>
  .upload-gate-hint {
    background: transparent;
    border: 0;
    color: var(--color-focus);
    cursor: pointer;
    font: inherit;
    padding: 0;
    text-align: start;
    text-decoration: underline;
  }
</style>
