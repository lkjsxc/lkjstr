<script lang="ts">
  import type { FeedScanHint } from '$lib/events/feed-scan-hints';
  import type { RelayReadScore } from '$lib/relays/relay-read-score';

  type Props = {
    scores: readonly RelayReadScore[];
    hints: readonly FeedScanHint[];
  };

  let props: Props = $props();
  let scoreRows = $derived(
    props.scores.toSorted((a, b) => b.score - a.score).slice(0, 8),
  );
  let hintRows = $derived(
    props.hints.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, 8),
  );

  function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
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
