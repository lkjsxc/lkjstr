<script lang="ts">
  import type { TimelineItem } from '$lib/timeline/timeline-store';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';
  import EventActions from './EventActions.svelte';
  import ReactionSummary from './ReactionSummary.svelte';
  import type {
    ReactionGroup,
    RepostGroup,
  } from '$lib/thread/thread-reactions';

  type Props = {
    item: TimelineItem;
    depth?: number;
    profile?: ProfileSummary;
    relaySets?: readonly RelaySet[];
    reactions?: readonly ReactionGroup[];
    reposts?: RepostGroup;
    profiles?: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let profile = $derived(
    props.profile?.pubkey === props.item.event.pubkey
      ? props.profile
      : undefined,
  );
  let highlighted = $state(false);
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;

  function openRow(event?: MouseEvent): void {
    if (event && shouldKeepLocal(event.target)) return;
    props.openThread?.(props.item.event.id);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') openRow();
  }

  function shouldKeepLocal(target: EventTarget | null): boolean {
    return Boolean(
      target instanceof Element &&
      target.closest('button,a,input,textarea,select,form,.event-action-zone'),
    );
  }

  function openProfile(event: MouseEvent): void {
    event.stopPropagation();
    props.openProfile?.(props.item.event.pubkey);
  }

  function highlightAction(): void {
    highlighted = true;
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => (highlighted = false), 900);
  }
</script>

<div
  class="event-row"
  class:event-row--action-success={highlighted}
  role="button"
  tabindex="0"
  style={`--event-depth: ${props.depth ?? 0}`}
  onclick={openRow}
  onkeydown={handleKeydown}
>
  <button
    type="button"
    class="avatar-button"
    aria-label="Open profile"
    onclick={openProfile}
  >
    <EventMeta event={props.item.event} relays={[]} {profile} avatarOnly />
  </button>
  <div class="event-main">
    <EventMeta
      event={props.item.event}
      relays={props.item.relays}
      {profile}
      openProfile={props.openProfile}
    />
    <EventContent
      event={props.item.event}
      relays={props.item.relays}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
    <EventActions
      event={props.item.event}
      {profile}
      relaySets={props.relaySets ?? []}
      onSuccess={highlightAction}
    />
    <ReactionSummary
      reactions={props.reactions}
      reposts={props.reposts}
      profiles={props.profiles}
      openProfile={props.openProfile}
    />
  </div>
</div>
