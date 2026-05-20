<script lang="ts">
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { bestDisplayName } from '$lib/identity/display-name';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NotificationKind } from '$lib/notifications/notification';
  import { activityBadge } from '$lib/notifications/activity-badge';

  type Props = {
    kind: NotificationKind;
    pubkey: string;
    profile?: ProfileSummary;
  };

  let props: Props = $props();
  let badge = $derived(activityBadge(props.kind));
  let name = $derived(
    bestDisplayName({ ...(props.profile ?? {}), pubkey: props.pubkey }),
  );
</script>

<span class="activity-avatar">
  <Avatar
    pubkey={props.pubkey}
    {name}
    src={props.profile?.avatarUrl}
    size="md"
  />
  {#if badge.visible}
    <span class="activity-avatar__badge" aria-hidden="true">{badge.mark}</span>
    <span class="sr-only">{badge.label}</span>
  {/if}
</span>
