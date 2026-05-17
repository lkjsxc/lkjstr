<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<svelte:head>
  <title>lkjstr</title>
</svelte:head>

<main class="home">
  <section>
    <p class="eyebrow">Nostr deck client</p>
    <h1>lkjstr</h1>
    <p class="summary">
      A browser-first operating surface for Nostr relays, timelines, profiles,
      threads, and publishing.
    </p>
    <a class="button" href={resolve('/deck')}>Open deck</a>
  </section>
</main>
