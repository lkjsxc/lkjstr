<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { RelaySet } from '$lib/relays/relay-store';
  import AccountManagerTab from '$lib/tabs/accounts/AccountManagerTab.svelte';
  import CacheStatusTab from '$lib/tabs/cache/CacheStatusTab.svelte';
  import NewTab from '$lib/tabs/new-tab/NewTab.svelte';
  import NotificationsTab from '$lib/tabs/notifications/NotificationsTab.svelte';
  import ProfileTab from '$lib/tabs/profile/ProfileTab.svelte';
  import RelayMonitorTab from '$lib/tabs/relays/RelayMonitorTab.svelte';
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
      />
    {/if}
    <div class="pane-actions">
      <NewTabButton open={() => props.openNewTab(props.pane.id)} />
      <TileMenu
        split={(direction) => props.split(props.pane.id, direction)}
        closePane={() => props.closePane(props.pane.id)}
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
          activeAccountPubkey={props.activeAccount?.pubkey}
          relaySets={props.relaySets}
          openProfile={(pubkey) => props.openProfile(props.pane.id, pubkey)}
          openThread={(eventId) => props.openThread(props.pane.id, eventId)}
        />
      {:else if active.kind === 'account-manager'}
        <AccountManagerTab
          accounts={props.accounts}
          addReadonly={props.addReadonly}
          addNip07={props.addNip07}
        />
      {:else if active.kind === 'notifications'}
        <NotificationsTab notifications={props.notifications} />
      {:else if active.kind === 'profile'}
        <ProfileTab
          tabId={active.id}
          pubkey={String(active.config.pubkey ?? '')}
          relaySets={props.relaySets}
        />
      {:else if active.kind === 'relay-monitor'}
        <RelayMonitorTab
          relaySets={props.relaySets}
          toggleRelay={props.toggleRelay}
          removeRelay={props.removeRelay}
        />
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
        />
      {/if}
    </div>
  {/if}
</section>
