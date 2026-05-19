<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { RelaySnapshot } from '$lib/relays/types';
  import AccountManagerTab from '$lib/tabs/accounts/AccountManagerTab.svelte';
  import CacheStatusTab from '$lib/tabs/cache/CacheStatusTab.svelte';
  import NewTab from '$lib/tabs/new-tab/NewTab.svelte';
  import NotificationsTab from '$lib/tabs/notifications/NotificationsTab.svelte';
  import ProfileTab from '$lib/tabs/profile/ProfileTab.svelte';
  import LkjstrLogTab from '$lib/tabs/log/LkjstrLogTab.svelte';
  import RelaySettingsTab from '$lib/tabs/relays/RelaySettingsTab.svelte';
  import SettingsTab from '$lib/tabs/settings/SettingsTab.svelte';
  import ThreadTab from '$lib/tabs/thread/ThreadTab.svelte';
  import TimelineTab from '$lib/tabs/timeline/TimelineTab.svelte';
  import TweetTab from '$lib/tabs/tweet/TweetTab.svelte';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';

  type Props = {
    tab: WorkspaceTab;
    paneId: string;
    accounts: Account[];
    activeAccount?: Account;
    notifications: NotificationRecord[];
    relaySets: RelaySet[];
    pageDataReady: boolean;
    relaySnapshots: RelaySnapshot[];
    convertTab: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
    addReadonly: () => void;
    addNip07: () => void;
    addReadonlyPubkey: (pubkey: string) => Promise<void>;
    refreshData: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
    openProfile: (paneId: string, pubkey: string) => void;
    openThread: (paneId: string, eventId: string) => void;
  };

  let props: Props = $props();
</script>

{#if props.tab.kind === 'new-tab'}
  <NewTab tabId={props.tab.id} convert={props.convertTab} />
{:else if props.tab.kind === 'timeline'}
  <TimelineTab
    tabId={props.tab.id}
    kind="home"
    activeAccountPubkey={props.activeAccount?.pubkey}
    dataReady={props.pageDataReady}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
  />
{:else if props.tab.kind === 'global'}
  <TimelineTab
    tabId={props.tab.id}
    kind="global"
    dataReady={props.pageDataReady}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
  />
{:else if props.tab.kind === 'account-manager'}
  <AccountManagerTab
    accounts={props.accounts}
    addReadonly={props.addReadonly}
    addNip07={props.addNip07}
    addReadonlyPubkey={props.addReadonlyPubkey}
  />
{:else if props.tab.kind === 'notifications'}
  <NotificationsTab
    tabId={props.tab.id}
    accountPubkey={props.activeAccount?.pubkey}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
  />
{:else if props.tab.kind === 'profile'}
  <ProfileTab
    tabId={props.tab.id}
    pubkey={String(props.tab.config.pubkey ?? '')}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
  />
{:else if props.tab.kind === 'relay-monitor'}
  <LkjstrLogTab snapshots={props.relaySnapshots} />
{:else if props.tab.kind === 'relay-settings'}
  <RelaySettingsTab
    relaySets={props.relaySets}
    refresh={props.refreshData}
    removeRelay={props.removeRelay}
  />
{:else if props.tab.kind === 'settings'}
  <SettingsTab />
{:else if props.tab.kind === 'cache-status'}
  <CacheStatusTab />
{:else if props.tab.kind === 'tweet'}
  <TweetTab accounts={props.accounts} relaySets={props.relaySets} />
{:else if props.tab.kind === 'thread'}
  <ThreadTab
    tabId={props.tab.id}
    eventId={String(props.tab.config.eventId ?? '')}
    relaySets={props.relaySets}
    openProfile={(pubkey) => props.openProfile(props.paneId, pubkey)}
    openThread={(eventId) => props.openThread(props.paneId, eventId)}
  />
{/if}
