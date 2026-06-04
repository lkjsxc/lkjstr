<script lang="ts">
  import type { FeedScanHint } from '$lib/events/feed-scan-hints';
  import type { RelayReadScore } from '$lib/relays/relay-read-score';
  import type { ScanOptimizerDebugSnapshot } from '$lib/feed-surface/scan-model-debug';

  type Props = {
    scores: readonly RelayReadScore[];
    hints: readonly FeedScanHint[];
    scanDebug: ScanOptimizerDebugSnapshot | null;
  };

  let props: Props = $props();
  let scoreRows = $derived(
    props.scores.toSorted((a, b) => b.score - a.score).slice(0, 8),
  );
  let hintRows = $derived(
    props.hints.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, 8),
  );
  let modelRows = $derived((props.scanDebug?.models ?? []).slice(0, 8));
  let traceRows = $derived((props.scanDebug?.decisionTraces ?? []).slice(0, 8));

  function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  function short(value: string | undefined): string {
    if (!value) return '-';
    return value.length > 24 ? `${value.slice(0, 24)}…` : value;
  }

  function time(value: number | undefined): string {
    return value ? new Date(value).toLocaleTimeString() : '-';
  }
</script>

<h3>Relay optimizer</h3>
<div class="stats-cards">
  <article>
    <strong>{props.scores.length}</strong><span>relay scores</span>
  </article>
  <article>
    <strong>{props.hints.length}</strong><span>scan hints</span>
  </article>
  <article>
    <strong>{props.scanDebug?.models.length ?? 0}</strong><span
      >density models</span
    >
  </article>
  <article>
    <strong>{props.scanDebug?.storageMode ?? 'loading'}</strong><span
      >scan storage</span
    >
  </article>
  <article>
    <strong>{props.scanDebug?.wasmBridge.state ?? 'loading'}</strong><span
      >scan WASM</span
    >
  </article>
</div>
<h4>Relay read scores</h4>
<table class="stats-table">
  <thead>
    <tr
      ><th>Relay</th><th>Surface</th><th>Score</th><th>Yield</th><th>Samples</th
      ></tr
    >
  </thead>
  <tbody>
    {#if scoreRows.length === 0}
      <tr><td colspan="5">No in-memory relay scores recorded yet</td></tr>
    {/if}
    {#each scoreRows as score (JSON.stringify(score.key))}
      <tr>
        <td>{score.key.relayUrl}</td>
        <td>{score.key.surface}</td>
        <td>{percent(score.score)}</td>
        <td>{percent(score.usefulYield)} / {percent(score.uniqueYield)}</td>
        <td>{score.sampleCount}</td>
      </tr>
    {/each}
  </tbody>
</table>
<h4>Scan hints</h4>
<table class="stats-table">
  <thead>
    <tr
      ><th>Scan key</th><th>Relay</th><th>Direction</th><th>Span</th><th
        >Feedback</th
      ></tr
    >
  </thead>
  <tbody>
    {#if hintRows.length === 0}
      <tr><td colspan="5">No in-memory scan hints recorded yet</td></tr>
    {/if}
    {#each hintRows as hint (hint.id)}
      <tr>
        <td>{hint.scanKey}</td>
        <td>{hint.relayUrl}</td>
        <td>{hint.direction}</td>
        <td>{hint.lastSpanSeconds}s → {hint.recommendedSpanSeconds}s</td>
        <td>{hint.lastFeedback}</td>
      </tr>
    {/each}
  </tbody>
</table>
<h4>Scan density models</h4>
<table class="stats-table">
  <thead>
    <tr
      ><th>Scope</th><th>Feed</th><th>Relay</th><th>Direction</th><th
        >Density</th
      ><th>Samples</th><th>Updated</th></tr
    >
  </thead>
  <tbody>
    {#if !props.scanDebug}
      <tr><td colspan="7">Loading scan model provider state</td></tr>
    {:else if props.scanDebug.storageMode === 'unavailable'}
      <tr
        ><td colspan="7"
          >SQLite scan models unavailable: {props.scanDebug
            .unavailableMessage ?? 'unavailable'}</td
        ></tr
      >
    {:else if props.scanDebug.wasmBridge.state === 'unavailable'}
      <tr
        ><td colspan="7"
          >Rust scan planner unavailable: {props.scanDebug.wasmBridge.message ??
            'unavailable'}</td
        ></tr
      >
    {:else if modelRows.length === 0}
      <tr><td colspan="7">No durable scan density models recorded yet</td></tr>
    {/if}
    {#each modelRows as model, index (`${model.modelKey}:${index}`)}
      <tr>
        <td>{model.scope}</td>
        <td>{short(model.semanticFeedKey)}</td>
        <td>{short(model.relayUrl)}</td>
        <td>{model.direction}</td>
        <td>{model.densityEventsPerSecond.toFixed(4)}</td>
        <td>{model.sampleWeight.toFixed(1)}</td>
        <td>{time(model.updatedAtMs)}</td>
      </tr>
    {/each}
  </tbody>
</table>
<h4>Scan decision traces</h4>
<table class="stats-table">
  <thead>
    <tr
      ><th>Trace</th><th>Model</th><th>Feed</th><th>Direction</th><th
        >Created</th
      ></tr
    >
  </thead>
  <tbody>
    {#if !props.scanDebug}
      <tr><td colspan="5">Loading scan decision provider state</td></tr>
    {:else if traceRows.length === 0}
      <tr><td colspan="5">No durable scan decision traces recorded yet</td></tr>
    {/if}
    {#each traceRows as trace, index (`${trace.traceId}:${index}`)}
      <tr>
        <td>{short(trace.traceId)}</td>
        <td>{short(trace.modelKey)}</td>
        <td>{short(trace.semanticFeedKey)}</td>
        <td>{trace.direction}</td>
        <td>{time(trace.createdAtMs)}</td>
      </tr>
    {/each}
  </tbody>
</table>
