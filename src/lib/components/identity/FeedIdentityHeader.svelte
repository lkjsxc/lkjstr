<script lang="ts">
  import Avatar from './Avatar.svelte';
  import UserEventRowMeta from './UserEventRowMeta.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { userEventRowView, type UserEventRowContext } from './user-event-row';

  type Props = {
    pubkey: string;
    profile?: ProfileSummary;
    context?: UserEventRowContext;
    label?: string;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();

  function open(event?: MouseEvent): void {
    if (!props.openProfile) return;
    if (event && shouldKeepLocal(event.target)) return;
    props.openProfile(props.pubkey);
  }

  function keydown(event: KeyboardEvent): void {
    if (!props.openProfile || event.target !== event.currentTarget) return;
    if (event.key === 'Enter') open();
  }

  function shouldKeepLocal(target: EventTarget | null): boolean {
    return Boolean(
      target instanceof Element &&
      target.closest('button,a,input,textarea,select,form,.event-action-zone'),
    );
  }
  let view = $derived(
    userEventRowView({
      pubkey: props.pubkey,
      profile: props.profile,
      context: props.context,
    }),
  );
</script>

{#if props.openProfile}
  <button
    type="button"
    class="feed-identity-header feed-identity-header--interactive"
    onclick={open}
    onkeydown={keydown}
  >
    {#if props.label}<p class="feed-identity-header__label">
        {props.label}
      </p>{/if}
    <div class="feed-identity-header__row">
      <Avatar pubkey={props.pubkey} name={view.title} src={view.avatarUrl} />
      <UserEventRowMeta
        pubkey={props.pubkey}
        profile={props.profile}
        context={props.context}
      />
    </div>
  </button>
{:else}
  <header class="feed-identity-header">
    {#if props.label}<p class="feed-identity-header__label">
        {props.label}
      </p>{/if}
    <div class="feed-identity-header__row">
      <Avatar pubkey={props.pubkey} name={view.title} src={view.avatarUrl} />
      <UserEventRowMeta
        pubkey={props.pubkey}
        profile={props.profile}
        context={props.context}
      />
    </div>
  </header>
{/if}
