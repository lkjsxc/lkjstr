<script lang="ts">
  import EventContent from '$lib/components/events/EventContent.svelte';
  import EventMeta from '$lib/components/events/EventMeta.svelte';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { FeedEvent } from '$lib/events/types';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import { notificationActionText } from '$lib/notifications/notification-presentation';

  type Props = {
    record: NotificationRecord;
    item?: FeedEvent;
    targetItem?: FeedEvent;
    profile?: ProfileSummary;
    profiles?: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let label = $derived(notificationActionText(props.record, props.item?.event));
  let time = $derived(new Date(props.record.createdAt * 1000).toLocaleString());
  let preview = $derived(props.targetItem ?? props.item);
</script>

<article class:unread={!props.record.readAt} class="notification-row">
  {#if !props.record.readAt}<span class="sr-only">Unread</span>{/if}
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
      <time datetime={new Date(props.record.createdAt * 1000).toISOString()}>
        {time}
      </time>
    </div>
    {#if preview}
      <div class="notification-row__preview">
        <EventMeta
          event={preview.event}
          relays={preview.relays}
          profile={props.profiles?.[preview.event.pubkey]}
          openProfile={props.openProfile}
        />
        <EventContent
          event={preview.event}
          relays={preview.relays}
          profiles={props.profiles}
          openProfile={props.openProfile}
          openThread={props.openThread}
        />
      </div>
    {:else}
      <p class="event-content">Event content unavailable.</p>
    {/if}
  </div>
</article>
