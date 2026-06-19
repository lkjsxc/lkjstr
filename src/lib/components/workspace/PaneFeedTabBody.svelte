<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { mountAuthorContextIsland } from './author-context-island';
  import { mountCustomRequestIsland } from './custom-request-island';
  import { mountFolloweesIsland } from './followees-island';
  import { mountGlobalIsland } from './global-island';
  import { mountHomeIsland } from './home-island';
  import { mountNotificationsIsland } from './notifications-island';
  import { mountProfileIsland } from './profile-island';
  import { mountSearchIsland } from './search-island';
  import { mountThreadIsland } from './thread-island';
  import { mountUserTimelineIsland } from './user-timeline-island';
  import { feedTabHost, type FeedTabMounts } from './feed-tab-host';
  import RustIslandHost from './RustIslandHost.svelte';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';
  import type { WorkspaceTab } from '$lib/workspace/tab';
  type Props = {
    tab: WorkspaceTab;
    visible: boolean;
    paneId: string;
    restoreAnchor?: TabFeedAnchor;
    restoreSnapshot?: TabSnapshotPayload;
    activeAccount?: Account;
    relaySets: RelaySet[];
    pageDataReady: boolean;
    openProfile: (paneId: string, pubkey: string) => void;
    openFollowees: (paneId: string, pubkey: string) => void;
    openUserTimeline: (paneId: string, pubkey: string) => void;
    openProfileEdit: (paneId: string) => void;
    openThread: (paneId: string, eventId: string) => void;
    openAuthorContext: (
      paneId: string,
      eventId: string,
      pubkey: string,
    ) => void;
  };

  let props: Props = $props();
  let followeesCopyStatus = $state('');
  const mounts = {
    timeline: mountHome,
    global: mountGlobal,
    search: mountSearch,
    customRequest: mountCustomRequest,
    notifications: mountNotifications,
    authorContext: mountAuthorContext,
    profile: mountProfile,
    followees: mountFollowees,
    userTimeline: mountUserTimeline,
    thread: mountThread,
  } satisfies FeedTabMounts;
  let host = $derived(
    feedTabHost({
      tab: props.tab,
      visible: props.visible,
      activePubkey: props.activeAccount?.pubkey,
      followeesCopyStatus,
      mounts,
    }),
  );
  const openProfile = (pubkey: string) =>
    props.openProfile(props.paneId, pubkey);
  const openThread = (eventId: string) =>
    props.openThread(props.paneId, eventId);
  const openFollowees = (pubkey: string) =>
    props.openFollowees(props.paneId, pubkey);
  const openUserTimeline = (pubkey: string) =>
    props.openUserTimeline(props.paneId, pubkey);
  const openAuthorContext = (eventId: string, pubkey: string) =>
    props.openAuthorContext(props.paneId, eventId, pubkey);
  function mountAuthorContext(parent: HTMLElement) {
    return mountAuthorContextIsland(parent, {
      tabId: props.tab.id,
      eventId: String(props.tab.config.eventId ?? ''),
      pubkey: String(props.tab.config.pubkey ?? ''),
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountUserTimeline(parent: HTMLElement) {
    return mountUserTimelineIsland(parent, {
      tabId: props.tab.id,
      pubkey: String(props.tab.config.pubkey ?? ''),
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountSearch(parent: HTMLElement) {
    return mountSearchIsland(parent, {
      tabId: props.tab.id,
      restoreSnapshot: props.restoreSnapshot,
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountGlobal(parent: HTMLElement) {
    return mountGlobalIsland(parent, {
      tabId: props.tab.id,
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountHome(parent: HTMLElement) {
    return mountHomeIsland(parent, {
      tabId: props.tab.id,
      activePubkey: props.activeAccount?.pubkey,
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountNotifications(parent: HTMLElement) {
    return mountNotificationsIsland(parent, {
      tabId: props.tab.id,
      activePubkey: props.activeAccount?.pubkey,
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountThread(parent: HTMLElement) {
    return mountThreadIsland(parent, {
      tabId: props.tab.id,
      eventId: String(props.tab.config.eventId ?? ''),
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountProfile(parent: HTMLElement) {
    return mountProfileIsland(parent, {
      tabId: props.tab.id,
      pubkey: String(props.tab.config.pubkey ?? ''),
      activePubkey: props.activeAccount?.pubkey,
      openProfile,
      openFollowees,
      openUserTimeline,
      openProfileEdit: () => props.openProfileEdit(props.paneId),
      openThread,
      openAuthorContext,
    });
  }
  function mountCustomRequest(parent: HTMLElement) {
    return mountCustomRequestIsland(parent, {
      tabId: props.tab.id,
      restoreSnapshot: props.restoreSnapshot,
      openProfile,
      openThread,
      openAuthorContext,
    });
  }
  function mountFollowees(parent: HTMLElement) {
    return mountFolloweesIsland(parent, {
      tabId: props.tab.id,
      pubkey: String(props.tab.config.pubkey ?? ''),
      openProfile,
      openUserTimeline,
      setCopyStatus: (status) => (followeesCopyStatus = status),
    });
  }
</script>

{#if host}
  <RustIslandHost
    label={host.label}
    className={host.className}
    mountKey={host.mountKey}
    fallbackError={host.fallbackError}
    status={host.status}
    mount={host.mount}
  />
{/if}
