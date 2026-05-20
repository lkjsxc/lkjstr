<script lang="ts">
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    publishReaction,
    publishReply,
    publishRepost,
  } from '$lib/events/actions';
  import { createZapInvoice } from '$lib/events/zap';

  type Mode = 'none' | 'reply' | 'emoji' | 'zap';
  type Props = {
    event: NostrEvent;
    profile?: ProfileSummary;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let mode = $state<Mode>('none');
  let reply = $state('');
  let emoji = $state('');
  let zapAmount = $state(21);
  let zapMessage = $state('');
  let status = $state('');
  let busy = $state(false);
  let lightningUri = $state('');

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    busy = true;
    status = '';
    try {
      const result = await action();
      status = result.ok ? 'Published.' : (result.message ?? 'Action failed.');
      if (result.ok) mode = 'none';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Action failed.';
    } finally {
      busy = false;
    }
  }

  function submitEmoji(): void {
    const parsed = customEmoji(emoji.trim());
    void run(() =>
      publishReaction(
        props.event,
        props.relaySets,
        parsed?.content ?? emoji.trim(),
        parsed?.emoji,
      ),
    );
  }

  async function zap(): Promise<void> {
    busy = true;
    status = '';
    lightningUri = '';
    try {
      const invoice = await createZapInvoice({
        event: props.event,
        profile: props.profile,
        relaySets: props.relaySets,
        amountSats: zapAmount,
        message: zapMessage,
      });
      lightningUri = invoice.uri;
      status = 'Invoice ready.';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Zap failed.';
    } finally {
      busy = false;
    }
  }

  function customEmoji(
    value: string,
  ):
    | { content: string; emoji: { shortcode: string; url: string } }
    | undefined {
    const match = /^:([^:]+):(https:\/\/\S+)$/.exec(value);
    return match
      ? {
          content: `:${match[1]}:`,
          emoji: { shortcode: match[1], url: match[2] },
        }
      : undefined;
  }
</script>

<div class="event-action-zone">
  <div class="event-actions">
    <button
      type="button"
      disabled={busy}
      onclick={() => run(() => publishReaction(props.event, props.relaySets))}
      >Heart</button
    >
    <button
      type="button"
      disabled={busy}
      onclick={() => run(() => publishRepost(props.event, props.relaySets))}
      >Repost</button
    >
    <button
      type="button"
      disabled={busy}
      onclick={() => (mode = mode === 'reply' ? 'none' : 'reply')}>Reply</button
    >
    <button
      type="button"
      disabled={busy}
      onclick={() => (mode = mode === 'zap' ? 'none' : 'zap')}>Zap</button
    >
    <button
      type="button"
      disabled={busy}
      onclick={() => (mode = mode === 'emoji' ? 'none' : 'emoji')}>Emoji</button
    >
  </div>
  {#if mode === 'reply'}
    <form
      class="event-inline-action"
      onsubmit={(event) => {
        event.preventDefault();
        void run(() => publishReply(props.event, props.relaySets, reply));
      }}
    >
      <textarea
        aria-label="Reply"
        bind:value={reply}
        onkeydown={(event) => {
          if (event.ctrlKey && event.key === 'Enter')
            void run(() => publishReply(props.event, props.relaySets, reply));
        }}
      ></textarea>
      <button type="submit" disabled={busy || !reply.trim()}
        >Publish reply</button
      >
    </form>
  {:else if mode === 'emoji'}
    <form
      class="event-inline-action"
      onsubmit={(event) => {
        event.preventDefault();
        submitEmoji();
      }}
    >
      <input
        aria-label="Emoji reaction"
        bind:value={emoji}
        placeholder="emoji or :shortcode:https://..."
      />
      <button type="submit" disabled={busy || !emoji.trim()}>React</button>
    </form>
  {:else if mode === 'zap'}
    <form
      class="event-inline-action"
      onsubmit={(event) => {
        event.preventDefault();
        void zap();
      }}
    >
      <input
        aria-label="Zap amount sats"
        type="number"
        min="1"
        bind:value={zapAmount}
      />
      <input aria-label="Zap message" bind:value={zapMessage} />
      <button type="submit" disabled={busy || zapAmount < 1}>Invoice</button>
      {#if lightningUri}
        <button
          type="button"
          onclick={() => window.open(lightningUri, '_blank')}
        >
          Open invoice
        </button>
        <button
          type="button"
          onclick={() => navigator.clipboard?.writeText(lightningUri)}
          >Copy</button
        >
      {/if}
    </form>
  {/if}
  {#if status}<p class="event-action-status" role="status">{status}</p>{/if}
</div>
