<script lang="ts">
  import { Heart, MessageCircle, Repeat2, Send, Zap } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { CustomEmoji, NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { loadAccountEmojiSource } from '$lib/emoji/source';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';
  import {
    publishReaction,
    publishReply,
    publishRepost,
  } from '$lib/events/actions';
  import EmojiPaletteButton from '$lib/components/emoji/EmojiPaletteButton.svelte';
  import EventZapPanel from './EventZapPanel.svelte';

  type Mode = 'none' | 'reply' | 'zap';
  type Props = {
    event: NostrEvent;
    profile?: ProfileSummary;
    activeAccountPubkey?: string | null;
    liked?: boolean;
    reposted?: boolean;
    relaySets: readonly RelaySet[];
    onSuccess?: () => void;
  };

  let props: Props = $props();
  let mode = $state<Mode>('none');
  let reply = $state('');
  let status = $state('');
  let busy = $state(false);
  let customEmojis = $state<readonly CustomEmoji[]>([]);
  let emojiLoadRequest = 0;
  let destroyed = false;
  let emojiSourceKey = $derived(
    `${props.activeAccountPubkey ?? ''}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );

  onDestroy(() => {
    destroyed = true;
  });

  $effect(() => {
    const key = emojiSourceKey;
    if (key === undefined) return;
    const request = ++emojiLoadRequest;
    const pubkey = props.activeAccountPubkey ?? undefined;
    const relays = timelineRelays(props.relaySets);
    void loadAccountEmojiSource({ pubkey, relays }).then((emoji) => {
      if (!destroyed && request === emojiLoadRequest) customEmojis = emoji;
    });
  });

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    busy = true;
    status = '';
    try {
      const result = await action();
      if (destroyed) return;
      status = result.ok ? '' : (result.message ?? 'Action failed.');
      if (result.ok) {
        mode = 'none';
        props.onSuccess?.();
      }
    } catch (error) {
      if (destroyed) return;
      status = error instanceof Error ? error.message : 'Action failed.';
    } finally {
      if (!destroyed) busy = false;
    }
  }

  function submitEmoji(reaction: {
    content: string;
    emoji?: CustomEmoji;
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
      class:icon-button--pressed={props.liked}
      title="Heart"
      disabled={busy}
      aria-pressed={props.liked}
      onclick={() => run(() => publishReaction(props.event, props.relaySets))}
    >
      <Heart size={16} />
      <span class="sr-only">Heart</span>
    </button>
    <button
      type="button"
      class="icon-button"
      class:icon-button--pressed={props.reposted}
      title="Repost"
      disabled={busy}
      aria-pressed={props.reposted}
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
    <EmojiPaletteButton
      {customEmojis}
      disabled={busy}
      onUnicode={(emoji) => submitEmoji({ content: emoji })}
      onCustom={(emoji) =>
        submitEmoji({ content: `:${emoji.shortcode}:`, emoji })}
    />
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
  {:else if mode === 'zap'}
    <EventZapPanel
      event={props.event}
      profile={props.profile}
      relaySets={props.relaySets}
    />
  {/if}
  {#if status}<p class="event-action-status" role="status">{status}</p>{/if}
</div>
