<script lang="ts">
  import FormTabShell from '$lib/components/workspace/FormTabShell.svelte';
  import { onDestroy } from 'svelte';
  import {
    createNpubMiner,
    estimatedAttempts,
    parseNpubPrefix,
    type NpubMinerEvent,
    type NpubMineProgress,
    type NpubMineResult,
  } from '$lib/accounts/npub-miner';
  import { copyMinedValue, minerCopyStatusText } from './miner-copy-status';

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
    if (!parsed.ok) return void (status = parsed.message);
    miner?.cancel();
    running = true;
    saved = false;
    result = undefined;
    progress = { attempts: 0, rate: 0, elapsedMs: 0 };
    status = `Mining npub1${parsed.prefix}`;
    miner = createNpubMiner(parsed.prefix, receiveMinerEvent);
  }

  function receiveMinerEvent(event: NpubMinerEvent): void {
    if (event.type === 'progress') progress = event.progress;
    if (event.type === 'error') stopWith(event.message);
    if (event.type === 'result') {
      running = false;
      result = event.result;
      progress = event.result;
      status = 'Match found.';
      miner = undefined;
    }
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

  async function copy(label: string, value: string): Promise<void> {
    status = minerCopyStatusText(
      await copyMinedValue(label, value, navigator.clipboard),
    );
  }

  async function addSigning(): Promise<void> {
    if (!result) return;
    try {
      await props.addMinedSigning(result.nsec);
      saved = true;
      status = 'Mined signing account added.';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Account add failed.';
    }
  }
</script>

<FormTabShell label="Mine npub" class="miner-panel data-tab">
  <label>
    Prefix after npub1
    <input bind:value={prefix} disabled={running} placeholder="lkj" />
  </label>
  {#if parsed.ok}
    <small>Expected attempts: {estimate.toLocaleString()}</small>
  {:else if prefix}
    <small>{parsed.message}</small>
  {/if}
  <div class="toolbar">
    <button type="button" disabled={running || !parsed.ok} onclick={startMining}
      >Start</button
    >
    <button type="button" disabled={!running} onclick={cancelMining}
      >Cancel</button
    >
  </div>
  <p>
    {progress.attempts.toLocaleString()} attempts, {progress.rate.toLocaleString()}
    per second
  </p>
  {#if status}<p role="status">{status}</p>{/if}
  {#if result}
    {@const mined = result}
    <article class="row">
      <strong>{mined.npub}</strong>
      <code>{mined.nsec}</code>
      <button type="button" onclick={() => copy('npub', mined.npub)}
        >Copy npub</button
      >
      <button type="button" onclick={() => copy('nsec', mined.nsec)}
        >Copy nsec</button
      >
      <button type="button" disabled={saved} onclick={addSigning}
        >Add signing account</button
      >
    </article>
  {/if}
</FormTabShell>
