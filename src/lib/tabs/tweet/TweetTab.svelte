<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { publishTweet } from '$lib/tweet/publish';
  import {
    clearTweetDraft,
    loadTweetDraft,
    saveTweetDraft,
  } from '$lib/tweet/draft-store';

  type Props = {
    accounts: Account[];
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let content = $state('');
  let message = $state('');
  let publishing = $state(false);
  let hasSigner = $derived(
    props.accounts.some((item) => item.signerType === 'nip07'),
  );

  onMount(async () => {
    const draft = await loadTweetDraft();
    content = draft?.content ?? '';
  });

  async function save(): Promise<void> {
    await saveTweetDraft(content, props.accounts[0]?.id ?? null);
  }

  async function publish(): Promise<void> {
    publishing = true;
    message = '';
    await save();
    const result = await publishTweet(content, props.relaySets);
    publishing = false;
    if (!result.ok) {
      message = result.message;
      return;
    }
    const accepted = result.results.filter((item) => item.accepted).length;
    message = `Published to ${accepted}/${result.results.length} relays.`;
    content = '';
    await clearTweetDraft();
  }
</script>

<section class="data-tab">
  <h2>Tweet</h2>
  <textarea
    aria-label="Tweet content"
    bind:value={content}
    id="tweet-content"
    name="tweet-content"
    oninput={() => save()}
  ></textarea>
  <div class="toolbar">
    <button
      type="button"
      disabled={publishing || content.trim().length === 0 || !hasSigner}
      onclick={publish}
    >
      {publishing ? 'Publishing...' : 'Publish'}
    </button>
  </div>
  {#if !hasSigner}
    <p>Add a NIP-07 account before publishing.</p>
  {/if}
  {#if message}
    <p role="status">{message}</p>
  {/if}
</section>
