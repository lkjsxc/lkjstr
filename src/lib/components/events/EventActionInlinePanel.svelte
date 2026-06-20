<script lang="ts">
  import { Send } from '@lucide/svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import EventZapPanel from './EventZapPanel.svelte';
  import type { EventActionPanelPlan } from './event-actions-panel-plan';
  import {
    submitEventActionReply,
    submitEventActionReplyShortcut,
  } from './event-actions-reply-plan';

  type Props = {
    event: NostrEvent;
    panel: EventActionPanelPlan;
    profile?: ProfileSummary;
    relaySets: readonly RelaySet[];
    reply: string;
    setReply: (reply: string) => void;
    submitReply: () => void;
  };

  let props: Props = $props();

  function updateReply(event: Event): void {
    props.setReply((event.currentTarget as HTMLTextAreaElement).value);
  }
</script>

{#if props.panel.kind === 'reply'}
  <form
    class="event-inline-action"
    onsubmit={(event) => submitEventActionReply(event, props.submitReply)}
  >
    <textarea
      aria-label={props.panel.replyLabel}
      value={props.reply}
      oninput={updateReply}
      onkeydown={(event) =>
        submitEventActionReplyShortcut(event, props.submitReply)}
    ></textarea>
    <button
      class="icon-button icon-button--submit"
      type="submit"
      title={props.panel.publishLabel}
      disabled={props.panel.submitDisabled}
    >
      <Send size={16} />
      <span class="sr-only">{props.panel.publishLabel}</span>
    </button>
  </form>
{:else if props.panel.kind === 'zap'}
  <EventZapPanel
    event={props.event}
    profile={props.profile}
    relaySets={props.relaySets}
  />
{/if}
