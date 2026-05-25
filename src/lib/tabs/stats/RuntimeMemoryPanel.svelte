<script lang="ts">
  import type { RuntimeMemorySnapshot } from '$lib/memory/runtime-memory';

  type Props = {
    memory: RuntimeMemorySnapshot | null;
  };

  let props: Props = $props();
</script>

<h3>Runtime memory</h3>
{#if props.memory}
  <div class="stats-cards">
    <article>
      <strong>{props.memory.appLogCount}</strong><span>app logs</span>
    </article>
    <article>
      <strong>{props.memory.relaySuppressionCount}</strong>
      <span>relay suppressions</span>
    </article>
    <article>
      <strong>{props.memory.subscriptions.inFlightReads}</strong>
      <span>in-flight reads</span>
    </article>
    <article>
      <strong>{props.memory.caches.contentTokens}</strong>
      <span>token cache</span>
    </article>
  </div>
  <p>
    fallback {props.memory.fallbackRepository.events} events · references
    {props.memory.caches.references} · profiles {props.memory.caches.profiles}
    {#if props.memory.jsHeap}
      · heap {props.memory.jsHeap.usedJSHeapSize}/{props.memory.jsHeap
        .jsHeapSizeLimit}
    {/if}
  </p>
{/if}
