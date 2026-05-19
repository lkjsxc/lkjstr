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
  import type { WorkspacePaneNode } from '$lib/workspace/pane';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import NewTabButton from './NewTabButton.svelte';
  import TabStrip from './TabStrip.svelte';
  import TileMenu from './TileMenu.svelte';

  type Props = {
    pane: WorkspacePaneNode;
    group?: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    accounts: Account[];
    activeAccount?: Account;
    notifications: NotificationRecord[];
    relaySets: RelaySet[];
    ready: boolean;
    relaySnapshots: RelaySnapshot[];
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    moveTab: (
      sourcePaneId: string,
      targetPaneId: string,
      tabId: string,
      targetIndex: number,
    ) => void;
    openTab: (paneId: string | null, kind: TabKind) => void;
    openNewTab: (paneId: string) => void;
    convertTab: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    closePane: (paneId: string) => void;
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
  let active = $derived(
    props.group?.activeTabId ? props.tabs[props.group.activeTabId] : undefined,
  );
</script>

<section class="pane" aria-label="Workspace pane">
  <header class="pane-head">
    {#if props.group}
      <TabStrip
        group={props.group}
        paneId={props.pane.id}
        tabs={props.tabs}
        focusTab={(tabId) => props.focusTab(props.pane.id, tabId)}
        closeTab={(tabId) => props.closeTab(props.pane.id, tabId)}
        moveTab={props.moveTab}
        disabled={!props.ready}
      />
    {/if}
    <div class="pane-actions">
      <NewTabButton
        open={() => props.openNewTab(props.pane.id)}
        disabled={!props.ready}
      />
      <TileMenu
        split={(direction) => props.split(props.pane.id, direction)}
        closePane={() => props.closePane(props.pane.id)}
        disabled={!props.ready}
      />
    </div>
  </header>

  {#if active}
    <div class="pane-body">
      {#if active.kind === 'new-tab'}
        <NewTab tabId={active.id} convert={props.convertTab} />
      {:else if active.kind === 'timeline'}
        <TimelineTab
          tabId={active.id}
          kind="home"
          activeAccountPubkey={props.activeAccount?.pubkey}
          relaySets={props.relaySets}
          openProfile={(pubkey) => props.openProfile(props.pane.id, pubkey)}
          openThread={(eventId) => props.openThread(props.pane.id, eventId)}
        />
      {:else if active.kind === 'global'}
        <TimelineTab
          tabId={active.id}
          kind="global"
          relaySets={props.relaySets}
          openProfile={(pubkey) => props.openProfile(props.pane.id, pubkey)}
          openThread={(eventId) => props.openThread(props.pane.id, eventId)}
        />
      {:else if active.kind === 'account-manager'}
        <AccountManagerTab
          accounts={props.accounts}
          addReadonly={props.addReadonly}
          addNip07={props.addNip07}
          addReadonlyPubkey={props.addReadonlyPubkey}
        />
      {:else if active.kind === 'notifications'}
        <NotificationsTab
          tabId={active.id}
          accountPubkey={props.activeAccount?.pubkey}
          relaySets={props.relaySets}
          openProfile={(pubkey) => props.openProfile(props.pane.id, pubkey)}
          openThread={(eventId) => props.openThread(props.pane.id, eventId)}
        />
      {:else if active.kind === 'profile'}
        <ProfileTab
          tabId={active.id}
          pubkey={String(active.config.pubkey ?? '')}
          relaySets={props.relaySets}
          openProfile={(pubkey) => props.openProfile(props.pane.id, pubkey)}
          openThread={(eventId) => props.openThread(props.pane.id, eventId)}
        />
      {:else if active.kind === 'relay-monitor'}
        <LkjstrLogTab snapshots={props.relaySnapshots} />
      {:else if active.kind === 'relay-settings'}
        <RelaySettingsTab
          relaySets={props.relaySets}
          refresh={props.refreshData}
          removeRelay={props.removeRelay}
        />
      {:else if active.kind === 'settings'}
        <SettingsTab />
      {:else if active.kind === 'cache-status'}
        <CacheStatusTab />
      {:else if active.kind === 'tweet'}
        <TweetTab accounts={props.accounts} relaySets={props.relaySets} />
      {:else if active.kind === 'thread'}
        <ThreadTab
          tabId={active.id}
          eventId={String(active.config.eventId ?? '')}
          relaySets={props.relaySets}
          openProfile={(pubkey) => props.openProfile(props.pane.id, pubkey)}
          openThread={(eventId) => props.openThread(props.pane.id, eventId)}
        />
      {/if}
    </div>
  {/if}
</section>
