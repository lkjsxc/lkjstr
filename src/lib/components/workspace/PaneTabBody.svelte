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
  import LkjstrLogTab from '$lib/tabs/log/LkjstrLogTab.svelte';
  import RelaySettingsTab from '$lib/tabs/relays/RelaySettingsTab.svelte';
  import SearchTab from '$lib/tabs/search/SearchTab.svelte';
  import SettingsTab from '$lib/tabs/settings/SettingsTab.svelte';
  import NetworkStatsTab from '$lib/tabs/stats/NetworkStatsTab.svelte';
  import ThreadTab from '$lib/tabs/thread/ThreadTab.svelte';
  import TimelineTab from '$lib/tabs/timeline/TimelineTab.svelte';
  import TweetTab from '$lib/tabs/tweet/TweetTab.svelte';
  import UploadSettingsTab from '$lib/tabs/upload-settings/UploadSettingsTab.svelte';
  import WelcomeTab from '$lib/tabs/welcome/WelcomeTab.svelte';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';

  type Props = {
    tab: WorkspaceTab;
    visible: boolean;
    paneId: string;
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
  };

  let props: Props = $props();
</script>

{#if props.tab.kind === 'welcome'}
  <WelcomeTab
    activeAccount={props.activeAccount}
    accounts={props.accounts}
    relaySets={props.relaySets}
  />
{:else if props.tab.kind === 'new-tab'}
  <NewTab
    tabId={props.tab.id}
    activeAccountPubkey={props.activeAccount?.pubkey}
    convert={props.convertTab}
  />
{:else if props.tab.kind === 'timeline'}
  <TimelineTab
    tabId={props.tab.id}
    kind="home"
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
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'custom-request'}
  <CustomRequestTab
    tabId={props.tab.id}
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
    pubkey={String(props.tab.config.pubkey ?? '')}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openProfileEdit={() => props.openProfileEdit(props.paneId)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{:else if props.tab.kind === 'relay-monitor'}
  <LkjstrLogTab />
{:else if props.tab.kind === 'relay-settings'}
  <RelaySettingsTab
    relaySets={props.relaySets}
    activeAccount={props.activeAccount}
    refresh={props.refreshData}
    removeRelay={props.removeRelay}
  />
{:else if props.tab.kind === 'network-stats'}
  <NetworkStatsTab />
{:else if props.tab.kind === 'settings'}
  <SettingsTab tabId={props.tab.id} />
{:else if props.tab.kind === 'tweet'}
  <TweetTab
    tabId={props.tab.id}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
  />
{:else if props.tab.kind === 'thread'}
  <ThreadTab
    tabId={props.tab.id}
    eventId={String(props.tab.config.eventId ?? '')}
    activeAccountPubkey={props.activeAccount?.pubkey}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
    openAuthorContext={(eventId, pubkey) =>
      props.openAuthorContext(props.paneId, eventId, pubkey)}
  />
{/if}
