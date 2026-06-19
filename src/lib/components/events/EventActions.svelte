<script lang="ts">
  import { Heart, MessageCircle, Repeat2, Send, Zap } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { CustomEmoji, NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { loadAccountEmojiSource } from '$lib/emoji/source';
  import {
    publishReaction,
    publishReply,
    publishRepost,
  } from '$lib/events/actions';
  import EmojiPaletteButton from '$lib/components/emoji/EmojiPaletteButton.svelte';
  import EventZapPanel from './EventZapPanel.svelte';
  import { loadEventActionEmojiSource } from './event-actions-emoji-source';
  import {
    canSubmitEventActionReply,
    eventActionLabels,
    planCustomEmojiEventReaction,
    planEventActionEmojiSource,
    planUnicodeEventReaction,
    runEventAction,
    submitEventActionReply,
    submitEventActionReplyShortcut,
    toggleEventActionMode,
    type EventActionMode,
    type EventActionResult,
    type EventActionReactionInput,
  } from './event-actions-plan';

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
  let mode = $state<EventActionMode>('none');
  let reply = $state('');
  let status = $state('');
  let busy = $state(false);
  let customEmojis = $state<readonly CustomEmoji[]>([]);
  let emojiLoadRequest = 0;
  let destroyed = false;
  const labels = eventActionLabels();
  let emojiSource = $derived(
    planEventActionEmojiSource(props.activeAccountPubkey, props.relaySets),
  );

  onDestroy(() => {
    destroyed = true;
  });

  $effect(() => {
    void loadEventActionEmojiSource(emojiSource, {
      loadAccountEmojiSource,
      nextRequest: () => ++emojiLoadRequest,
      isCurrent: (request) => !destroyed && request === emojiLoadRequest,
      setCustomEmojis: (emoji) => {
        customEmojis = emoji;
      },
    });
  });

  async function run(action: () => Promise<EventActionResult>) {
    await runEventAction(action, {
      getMode: () => mode,
      isDestroyed: () => destroyed,
      onSuccess: props.onSuccess,
      setBusy: (next) => (busy = next),
      setMode: (next) => (mode = next),
      setStatus: (next) => (status = next),
    });
  }

  function submitEmoji(reaction: EventActionReactionInput): void {
    void run(() =>
      publishReaction(
        props.event,
        props.relaySets,
        reaction.content,
        reaction.emoji,
      ),
    );
  }

  function submitReply(): void {
    void run(() => publishReply(props.event, props.relaySets, reply));
  }
</script>

<div class="event-action-zone">
  <div class="event-actions">
    <button
      type="button"
      class="icon-button"
      class:icon-button--pressed={props.liked}
      title={labels.heart}
      disabled={busy}
      aria-pressed={props.liked}
      onclick={() => run(() => publishReaction(props.event, props.relaySets))}
    >
      <Heart size={16} />
      <span class="sr-only">{labels.heart}</span>
    </button>
    <button
      type="button"
      class="icon-button"
      class:icon-button--pressed={props.reposted}
      title={labels.repost}
      disabled={busy}
      aria-pressed={props.reposted}
      onclick={() => run(() => publishRepost(props.event, props.relaySets))}
    >
      <Repeat2 size={16} />
      <span class="sr-only">{labels.repost}</span>
    </button>
    <button
      type="button"
      class:active={mode === 'reply'}
      class="icon-button"
      aria-pressed={mode === 'reply'}
      title={labels.reply}
      disabled={busy}
      onclick={() => (mode = toggleEventActionMode(mode, 'reply'))}
    >
      <MessageCircle size={16} />
      <span class="sr-only">{labels.reply}</span>
    </button>
    <button
      type="button"
      class:active={mode === 'zap'}
      class="icon-button"
      aria-pressed={mode === 'zap'}
      title={labels.zap}
      disabled={busy}
      onclick={() => (mode = toggleEventActionMode(mode, 'zap'))}
    >
      <Zap size={16} />
      <span class="sr-only">{labels.zap}</span>
    </button>
    <EmojiPaletteButton
      {customEmojis}
      disabled={busy}
      onUnicode={(emoji) => submitEmoji(planUnicodeEventReaction(emoji))}
      onCustom={(emoji) => submitEmoji(planCustomEmojiEventReaction(emoji))}
    />
  </div>
  {#if mode === 'reply'}
    <form
      class="event-inline-action"
      onsubmit={(event) => submitEventActionReply(event, submitReply)}
    >
      <textarea
        aria-label={labels.reply}
        bind:value={reply}
        onkeydown={(event) =>
          submitEventActionReplyShortcut(event, submitReply)}
      ></textarea>
      <button
        class="icon-button icon-button--submit"
        type="submit"
        title={labels.publishReply}
        disabled={!canSubmitEventActionReply(reply, busy)}
      >
        <Send size={16} />
        <span class="sr-only">{labels.publishReply}</span>
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
