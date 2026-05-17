<script lang="ts">
  let content = $state('');
</script>

<section class="data-tab">
  <h2>Compose</h2>
  <textarea aria-label="Note content" bind:value={content}></textarea>
  <button type="button" disabled={content.trim().length === 0}>
    Publish requires a signer account
  </button>
</section>
