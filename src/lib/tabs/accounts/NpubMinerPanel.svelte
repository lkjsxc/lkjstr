<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    createNpubMiner,
    estimatedAttempts,
    parseNpubPrefix,
    type NpubMineProgress,
    type NpubMineResult,
  } from '$lib/accounts/npub-miner';

  type Props = {
    addMinedSigning: (nsec: string) => Promise<void>;
  };

  let props: Props = $props();
  let prefix = $state('');
  let running = $state(false);
  let status = $state('');
  let saved = $state(false);
  let progress = $state<NpubMineProgress>({
    attempts: 0,
    rate: 0,
    elapsedMs: 0,
  });
  let result = $state<NpubMineResult>();
  let miner: { readonly cancel: () => void } | undefined;
  let parsed = $derived(parseNpubPrefix(prefix));
  let estimate = $derived(parsed.ok ? estimatedAttempts(parsed.prefix) : 0);

  onDestroy(() => miner?.cancel());

  function startMining(): void {
    if (!parsed.ok) {
      status = parsed.message;
      return;
    }
    miner?.cancel();
    running = true;
    saved = false;
    result = undefined;
    progress = { attempts: 0, rate: 0, elapsedMs: 0 };
    status = `Mining npub1${parsed.prefix}`;
    miner = createNpubMiner(parsed.prefix, (event) => {
      if (event.type === 'progress') progress = event.progress;
      if (event.type === 'error') stopWith(event.message);
      if (event.type === 'result') {
        running = false;
        result = event.result;
        progress = event.result;
        status = 'Match found.';
      }
    });
  }

  function cancelMining(): void {
    miner?.cancel();
    miner = undefined;
    running = false;
    status = 'Mining cancelled.';
  }

  function stopWith(message: string): void {
    miner?.cancel();
    miner = undefined;
    running = false;
    status = message;
  }

  async function copy(value: string): Promise<void> {
    await navigator.clipboard?.writeText(value);
    status = 'Copied.';
  }

  async function addSigning(): Promise<void> {
    if (!result) return;
    await props.addMinedSigning(result.nsec);
    saved = true;
    status = 'Mined signing account added.';
  }
</script>

<section class="miner-panel" aria-label="Npub mining">
  <h3>Mine npub</h3>
  <label>
    Prefix after npub1
    <input
      bind:value={prefix}
      disabled={running}
      id="npub-miner-prefix"
      name="npub-miner-prefix"
      placeholder="lkj"
    />
  </label>
  {#if parsed.ok}
    <small>Expected attempts: {estimate.toLocaleString()}</small>
  {:else if prefix}
    <small>{parsed.message}</small>
  {/if}
  <div class="toolbar">
    <button
      type="button"
      disabled={running || !parsed.ok}
      onclick={startMining}
    >
      Start
    </button>
    <button type="button" disabled={!running} onclick={cancelMining}>
      Cancel
    </button>
  </div>
  <p>
    {progress.attempts.toLocaleString()} attempts,
    {progress.rate.toLocaleString()} per second
  </p>
  {#if status}<p>{status}</p>{/if}
  {#if result}
    {@const mined = result}
    <article class="row">
      <strong>{mined.npub}</strong>
      <code>{mined.nsec}</code>
      <button type="button" onclick={() => copy(mined.npub)}>Copy npub</button>
      <button type="button" onclick={() => copy(mined.nsec)}>Copy nsec</button>
      <button type="button" disabled={saved} onclick={addSigning}>
        Add signing account
      </button>
    </article>
  {/if}
</section>
