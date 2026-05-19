<script lang="ts">
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import { NotificationRuntime } from '$lib/notifications/notification-runtime';
  import type { NotificationState } from '$lib/notifications/notification-runtime';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';

  type Props = {
    tabId: string;
    accountPubkey?: string;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let runtime: NotificationRuntime | undefined;
  let state = $state<NotificationState>({
    records: [],
    items: [],
    loading: true,
    error: null,
  });

  $effect(() => {
    runtime = new NotificationRuntime(
      props.accountPubkey,
      timelineRelays(props.relaySets),
      createTimelineSubId(props.tabId),
    );
    const unsubscribe = runtime.subscribe((next) => (state = next));
    void runtime.start().then(() => runtime?.markVisibleRead());
    const onFocus = () => runtime?.markVisibleRead();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      runtime?.close();
    };
  });
</script>

<section class="data-tab" aria-label="Notifications">
  <h2>Notifications</h2>
  {#if state.loading}<p>Loading notifications...</p>{/if}
  {#if state.error}<p role="alert">{state.error}</p>{/if}
  <EventTreeList
    items={state.items}
    loading={state.loading}
    emptyText="No notifications for the active account."
  />
</section>
