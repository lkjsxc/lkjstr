<script lang="ts">
  import Avatar from './Avatar.svelte';
  import UserEventRowActions from './UserEventRowActions.svelte';
  import UserEventRowMeta from './UserEventRowMeta.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { userEventRowView, type UserEventRowContext } from './user-event-row';

  type Props = {
    pubkey: string;
    profile?: ProfileSummary;
    context?: UserEventRowContext;
    compact?: boolean;
    copied?: boolean;
    openProfile: (pubkey: string) => void;
    openUserTimeline?: (pubkey: string) => void;
    copyNpub?: (pubkey: string) => void | Promise<void>;
  };

  let props: Props = $props();
  let view = $derived(
    userEventRowView({
      pubkey: props.pubkey,
      profile: props.profile,
      context: props.context,
    }),
  );

  function openRow(event?: MouseEvent): void {
    if (event && shouldKeepLocal(event.target)) return;
    props.openProfile(props.pubkey);
  }

  function keydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') openRow();
  }

  function shouldKeepLocal(target: EventTarget | null): boolean {
    return Boolean(
      target instanceof Element &&
      target.closest('button,a,input,textarea,select,form,.event-action-zone'),
    );
  }
</script>

<div
  class="user-event-row"
  class:user-event-row--compact={props.compact}
  role="button"
  tabindex="0"
  onclick={openRow}
  onkeydown={keydown}
>
  <Avatar
    pubkey={props.pubkey}
    name={view.title}
    src={view.avatarUrl}
    size={props.compact ? 'sm' : 'md'}
  />
  <div class="user-event-row__main">
    <UserEventRowMeta
      pubkey={props.pubkey}
      profile={props.profile}
      context={props.context}
      compact={props.compact}
    />
    <UserEventRowActions
      pubkey={props.pubkey}
      copied={props.copied}
      openProfile={props.openProfile}
      openUserTimeline={props.openUserTimeline}
      copyNpub={props.copyNpub}
    />
  </div>
</div>
