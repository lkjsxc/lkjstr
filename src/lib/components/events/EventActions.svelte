<script lang="ts">
  import { Heart, MessageCircle, Repeat2, Zap } from '@lucide/svelte';
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
  import EventActionIconButton from './EventActionIconButton.svelte';
  import EventActionInlinePanel from './EventActionInlinePanel.svelte';
  import { planEventActionControls } from './event-actions-control-plan';
  import { loadEventActionEmojiSource } from './event-actions-emoji-source';
  import { eventActionLabels } from './event-actions-label-plan';
  import { planEventActionPanel } from './event-actions-panel-plan';
  import {
    toggleEventActionMode,
    type EventActionMode,
  } from './event-actions-plan';
  import {
    planCustomEmojiEventReaction,
    planEventActionEmojiSource,
    planUnicodeEventReaction,
    type EventActionReactionInput,
  } from './event-actions-reaction-plan';
  import {
    runEventAction,
    type EventActionResult,
  } from './event-actions-run-plan';

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
  let controls = $derived(
    planEventActionControls({
      mode,
      busy,
      liked: props.liked,
      reposted: props.reposted,
      labels,
    }),
  );
  let panel = $derived(
    planEventActionPanel({
      mode,
      busy,
      reply,
      labels,
    }),
  );
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
    <EventActionIconButton
      pressed={controls.heart.pressed}
      title={controls.heart.title}
      disabled={controls.heart.disabled}
      ariaPressed={controls.heart.pressed}
      label={labels.heart}
      onclick={() => run(() => publishReaction(props.event, props.relaySets))}
    >
      <Heart size={16} />
    </EventActionIconButton>
    <EventActionIconButton
      pressed={controls.repost.pressed}
      title={controls.repost.title}
      disabled={controls.repost.disabled}
      ariaPressed={controls.repost.pressed}
      label={labels.repost}
      onclick={() => run(() => publishRepost(props.event, props.relaySets))}
    >
      <Repeat2 size={16} />
    </EventActionIconButton>
    <EventActionIconButton
      active={controls.reply.active}
      ariaPressed={controls.reply.active}
      title={controls.reply.title}
      disabled={controls.reply.disabled}
      label={labels.reply}
      onclick={() => (mode = toggleEventActionMode(mode, 'reply'))}
    >
      <MessageCircle size={16} />
    </EventActionIconButton>
    <EventActionIconButton
      active={controls.zap.active}
      ariaPressed={controls.zap.active}
      title={controls.zap.title}
      disabled={controls.zap.disabled}
      label={labels.zap}
      onclick={() => (mode = toggleEventActionMode(mode, 'zap'))}
    >
      <Zap size={16} />
    </EventActionIconButton>
    <EmojiPaletteButton
      {customEmojis}
      disabled={busy}
      onUnicode={(emoji) => submitEmoji(planUnicodeEventReaction(emoji))}
      onCustom={(emoji) => submitEmoji(planCustomEmojiEventReaction(emoji))}
    />
  </div>
  <EventActionInlinePanel
    {panel}
    event={props.event}
    profile={props.profile}
    relaySets={props.relaySets}
    {reply}
    setReply={(next) => (reply = next)}
    {submitReply}
  />
  {#if status}<p class="event-action-status" role="status">{status}</p>{/if}
</div>
