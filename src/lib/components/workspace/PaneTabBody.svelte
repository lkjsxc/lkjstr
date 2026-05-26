<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import AccountManagerTab from '$lib/tabs/accounts/AccountManagerTab.svelte';
  import AuthorContextTab from '$lib/tabs/author-context/AuthorContextTab.svelte';
  import CustomRequestTab from '$lib/tabs/custom-request/CustomRequestTab.svelte';
  import NewTab from '$lib/tabs/new-tab/NewTab.svelte';
  import NpubMinerTab from '$lib/tabs/npub-miner/NpubMinerTab.svelte';
  import NotificationsTab from '$lib/tabs/notifications/NotificationsTab.svelte';
  import ProfileEditTab from '$lib/tabs/profile-edit/ProfileEditTab.svelte';
  import ProfileTab from '$lib/tabs/profile/ProfileTab.svelte';
  import SearchTab from '$lib/tabs/search/SearchTab.svelte';
  import ThreadTab from '$lib/tabs/thread/ThreadTab.svelte';
  import TimelineTab from '$lib/tabs/timeline/TimelineTab.svelte';
  import UploadSettingsTab from '$lib/tabs/upload-settings/UploadSettingsTab.svelte';
  import PaneTabBodyTools from './PaneTabBodyTools.svelte';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

  type Props = {
    tab: WorkspaceTab;
    visible: boolean;
    paneId: string;
    restoreAnchor?: TabFeedAnchor;
    restoreSnapshot?: import('$lib/workspace/tab-snapshot').TabSnapshotPayload;
    restoreScrollTop?: number;
    accounts: Account[];
    activeAccount?: Account;
    relaySets: RelaySet[];
    pageDataReady: boolean;
    convertTab: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
    addMinedSigning: (nsec: string) => Promise<void>;
    refreshData: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
    openProfile: (paneId: string, pubkey: string) => void;
    openProfileEdit: (paneId: string) => void;
    openThread: (paneId: string, eventId: string) => void;
    openAuthorContext: (
      paneId: string,
      eventId: string,
      pubkey: string,
    ) => void;
    openTool: (paneId: string, kind: TabKind) => void;
  };

  let props: Props = $props();
</script>

{#if props.tab.kind === 'new-tab'}
  <NewTab
    tabId={props.tab.id}
    activeAccountPubkey={props.activeAccount?.pubkey}
    convert={props.convertTab}
  />
{:else if props.tab.kind === 'timeline'}
  <TimelineTab
    tabId={props.tab.id}
    kind="home"
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    activeAccountPubkey={props.activeAccount?.pubkey}
    dataReady={props.pageDataReady}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'global'}
  <TimelineTab
    tabId={props.tab.id}
    kind="global"
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    activeAccountPubkey={props.activeAccount?.pubkey}
    dataReady={props.pageDataReady}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'search'}
  <SearchTab
    tabId={props.tab.id}
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'custom-request'}
  <CustomRequestTab
    tabId={props.tab.id}
    restoreAnchor={props.restoreAnchor}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'account-manager'}
  <AccountManagerTab
    accounts={props.accounts}
    activeAccount={props.activeAccount}
    refreshData={props.refreshData}
  />
{:else if props.tab.kind === 'npub-miner'}
  <NpubMinerTab addMinedSigning={props.addMinedSigning} />
{:else if props.tab.kind === 'notifications'}
  <NotificationsTab
    tabId={props.tab.id}
    accountPubkey={props.activeAccount?.pubkey}
    visible={props.visible}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'author-context'}
  <AuthorContextTab
    tabId={props.tab.id}
    eventId={String(props.tab.config.eventId ?? '')}
    pubkey={String(props.tab.config.pubkey ?? '')}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'profile-edit'}
  <ProfileEditTab
    tabId={props.tab.id}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
  />
{:else if props.tab.kind === 'upload-settings'}
  <UploadSettingsTab />
{:else if props.tab.kind === 'profile'}
  <ProfileTab
    tabId={props.tab.id}
    restoreAnchor={props.restoreAnchor}
    pubkey={String(props.tab.config.pubkey ?? '')}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openProfileEdit={() => props.openProfileEdit(props.paneId)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'relay-monitor' || props.tab.kind === 'relay-settings' || props.tab.kind === 'network-stats' || props.tab.kind === 'settings' || props.tab.kind === 'tweet' || props.tab.kind === 'welcome'}
  <PaneTabBodyTools
    tab={props.tab}
    restoreScrollTop={props.restoreScrollTop}
    accounts={props.accounts}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    refreshData={props.refreshData}
    removeRelay={props.removeRelay}
    openTool={props.openTool}
    paneId={props.paneId}
  />
{:else if props.tab.kind === 'thread'}
  <ThreadTab
    tabId={props.tab.id}
    restoreAnchor={props.restoreAnchor}
    eventId={String(props.tab.config.eventId ?? '')}
    activeAccountPubkey={props.activeAccount?.pubkey}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{/if}
