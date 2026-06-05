<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import AuthorContextTab from '$lib/tabs/author-context/AuthorContextTab.svelte';
  import CustomRequestTab from '$lib/tabs/custom-request/CustomRequestTab.svelte';
  import NotificationsTab from '$lib/tabs/notifications/NotificationsTab.svelte';
  import ProfileTab from '$lib/tabs/profile/ProfileTab.svelte';
  import SearchTab from '$lib/tabs/search/SearchTab.svelte';
  import ThreadTab from '$lib/tabs/thread/ThreadTab.svelte';
  import TimelineTab from '$lib/tabs/timeline/TimelineTab.svelte';
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
    openProfileEdit: (paneId: string) => void;
    openThread: (paneId: string, eventId: string) => void;
    openAuthorContext: (
      paneId: string,
      eventId: string,
      pubkey: string,
    ) => void;
  };

  let props: Props = $props();
  const openProfile = (pubkey: string) =>
    props.openProfile(props.paneId, pubkey);
  const openThread = (eventId: string) =>
    props.openThread(props.paneId, eventId);
  const openAuthorContext = (eventId: string, pubkey: string) =>
    props.openAuthorContext(props.paneId, eventId, pubkey);
</script>

{#if props.tab.kind === 'timeline'}
  <TimelineTab
    tabId={props.tab.id}
    visible={props.visible}
    kind="home"
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    activeAccountPubkey={props.activeAccount?.pubkey}
    dataReady={props.pageDataReady}
    relaySets={props.relaySets}
    {openProfile}
    {openThread}
    {openAuthorContext}
  />
{:else if props.tab.kind === 'global'}
  <TimelineTab
    tabId={props.tab.id}
    visible={props.visible}
    kind="global"
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    activeAccountPubkey={props.activeAccount?.pubkey}
    dataReady={props.pageDataReady}
    relaySets={props.relaySets}
    {openProfile}
    {openThread}
    {openAuthorContext}
  />
{:else if props.tab.kind === 'search'}
  <SearchTab
    tabId={props.tab.id}
    visible={props.visible}
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    relaySets={props.relaySets}
    {openProfile}
    {openThread}
    {openAuthorContext}
  />
{:else if props.tab.kind === 'custom-request'}
  <CustomRequestTab
    tabId={props.tab.id}
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    relaySets={props.relaySets}
    {openProfile}
    {openThread}
    {openAuthorContext}
  />
{:else if props.tab.kind === 'notifications'}
  <NotificationsTab
    tabId={props.tab.id}
    accountPubkey={props.activeAccount?.pubkey}
    visible={props.visible}
    restoreAnchor={props.restoreAnchor}
    relaySets={props.relaySets}
    {openProfile}
    {openThread}
    {openAuthorContext}
  />
{:else if props.tab.kind === 'author-context'}
  <AuthorContextTab
    tabId={props.tab.id}
    visible={props.visible}
    eventId={String(props.tab.config.eventId ?? '')}
    pubkey={String(props.tab.config.pubkey ?? '')}
    restoreAnchor={props.restoreAnchor}
    relaySets={props.relaySets}
    {openProfile}
    {openThread}
    {openAuthorContext}
  />
{:else if props.tab.kind === 'profile'}
  <ProfileTab
    tabId={props.tab.id}
    visible={props.visible}
    restoreAnchor={props.restoreAnchor}
    pubkey={String(props.tab.config.pubkey ?? '')}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    {openProfile}
    openProfileEdit={() => props.openProfileEdit(props.paneId)}
    {openThread}
    {openAuthorContext}
  />
{:else if props.tab.kind === 'thread'}
  <ThreadTab
    tabId={props.tab.id}
    visible={props.visible}
    restoreAnchor={props.restoreAnchor}
    eventId={String(props.tab.config.eventId ?? '')}
    activeAccountPubkey={props.activeAccount?.pubkey}
    relaySets={props.relaySets}
    {openProfile}
    {openThread}
    {openAuthorContext}
  />
{/if}
