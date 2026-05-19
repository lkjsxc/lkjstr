<script lang="ts">
  import EventContent from '$lib/components/events/EventContent.svelte';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { FeedEvent } from '$lib/events/types';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import {
    notificationActionLabel,
    notificationContext,
  } from '$lib/notifications/notification-presentation';

  type Props = {
    record: NotificationRecord;
    item?: FeedEvent;
    profile?: ProfileSummary;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let label = $derived(notificationActionLabel(props.record.kind));
  let context = $derived(notificationContext(props.record));
  let time = $derived(new Date(props.record.createdAt * 1000).toLocaleString());
</script>

<article class:unread={!props.record.readAt} class="notification-row">
  <button
    type="button"
    class="identity-button"
    onclick={() => props.openProfile?.(props.record.actorPubkey)}
  >
    <IdentityChip pubkey={props.record.actorPubkey} profile={props.profile} />
  </button>
  <div class="notification-row__body">
    <div class="notification-row__meta">
      <strong>{label}</strong>
      <span>{props.record.readAt ? 'read' : 'unread'}</span>
      {#if context}
        <button
          type="button"
          onclick={() =>
            props.openThread?.(
              props.record.targetEventId ?? props.record.rootEventId ?? '',
            )}
        >
          {context}
        </button>
      {/if}
      <time datetime={new Date(props.record.createdAt * 1000).toISOString()}>
        {time}
      </time>
    </div>
    {#if props.item}
      <EventContent
        event={props.item.event}
        relays={props.item.relays}
        openProfile={props.openProfile}
        openThread={props.openThread}
      />
    {:else}
      <p class="event-content">Event content unavailable.</p>
    {/if}
  </div>
</article>
