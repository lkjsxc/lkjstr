<script lang="ts">
  import {
    Heart,
    MessageCircle,
    Repeat2,
    Send,
    Smile,
    Zap,
  } from '@lucide/svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    publishReaction,
    publishReply,
    publishRepost,
  } from '$lib/events/actions';
  import EventEmojiPanel from './EventEmojiPanel.svelte';
  import EventZapPanel from './EventZapPanel.svelte';

  type Mode = 'none' | 'reply' | 'emoji' | 'zap';
  type Props = {
    event: NostrEvent;
    profile?: ProfileSummary;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let mode = $state<Mode>('none');
  let reply = $state('');
  let status = $state('');
  let busy = $state(false);

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

  function submitEmoji(reaction: {
    content: string;
    emoji?: { shortcode: string; url: string };
  }): void {
    void run(() =>
      publishReaction(
        props.event,
        props.relaySets,
        reaction.content,
        reaction.emoji,
      ),
    );
  }
</script>

<div class="event-action-zone">
  <div class="event-actions">
    <button
      type="button"
      class="icon-button"
      title="Heart"
      disabled={busy}
      onclick={() => run(() => publishReaction(props.event, props.relaySets))}
    >
      <Heart size={16} />
      <span class="sr-only">Heart</span>
    </button>
    <button
      type="button"
      class="icon-button"
      title="Repost"
      disabled={busy}
      onclick={() => run(() => publishRepost(props.event, props.relaySets))}
    >
      <Repeat2 size={16} />
      <span class="sr-only">Repost</span>
    </button>
    <button
      type="button"
      class:active={mode === 'reply'}
      class="icon-button"
      aria-pressed={mode === 'reply'}
      title="Reply"
      disabled={busy}
      onclick={() => (mode = mode === 'reply' ? 'none' : 'reply')}
    >
      <MessageCircle size={16} />
      <span class="sr-only">Reply</span>
    </button>
    <button
      type="button"
      class:active={mode === 'zap'}
      class="icon-button"
      aria-pressed={mode === 'zap'}
      title="Zap"
      disabled={busy}
      onclick={() => (mode = mode === 'zap' ? 'none' : 'zap')}
    >
      <Zap size={16} />
      <span class="sr-only">Zap</span>
    </button>
    <button
      type="button"
      class:active={mode === 'emoji'}
      class="icon-button"
      title="Emoji"
      aria-pressed={mode === 'emoji'}
      disabled={busy}
      onclick={() => (mode = mode === 'emoji' ? 'none' : 'emoji')}
    >
      <Smile size={16} />
      <span class="sr-only">Emoji</span>
    </button>
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
      <button
        class="icon-button icon-button--submit"
        type="submit"
        title="Publish reply"
        disabled={busy || !reply.trim()}
      >
        <Send size={16} />
        <span class="sr-only">Publish reply</span>
      </button>
    </form>
  {:else if mode === 'emoji'}
    <EventEmojiPanel {busy} publish={submitEmoji} />
  {:else if mode === 'zap'}
    <EventZapPanel
      event={props.event}
      profile={props.profile}
      relaySets={props.relaySets}
    />
  {/if}
  {#if status}<p class="event-action-status" role="status">{status}</p>{/if}
</div>
