<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import type { RelaySet } from '$lib/relays/relay-store';
  import AccountManagerTab from '$lib/tabs/accounts/AccountManagerTab.svelte';
  import CacheStatusTab from '$lib/tabs/cache/CacheStatusTab.svelte';
  import ComposerTab from '$lib/tabs/composer/ComposerTab.svelte';
  import NewTab from '$lib/tabs/new-tab/NewTab.svelte';
  import NotificationsTab from '$lib/tabs/notifications/NotificationsTab.svelte';
  import PostManagerTab from '$lib/tabs/posts/PostManagerTab.svelte';
  import ProfileTab from '$lib/tabs/profile/ProfileTab.svelte';
  import RelayMonitorTab from '$lib/tabs/relays/RelayMonitorTab.svelte';
  import RelaySettingsTab from '$lib/tabs/relays/RelaySettingsTab.svelte';
  import SettingsTab from '$lib/tabs/settings/SettingsTab.svelte';
  import ThreadTab from '$lib/tabs/thread/ThreadTab.svelte';
  import TimelineTab from '$lib/tabs/timeline/TimelineTab.svelte';
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
    notifications: NotificationRecord[];
    postNodes: PostTreeNode[];
    relaySets: RelaySet[];
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
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
    createDraft: () => void;
    refreshData: () => void;
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
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
        tabs={props.tabs}
        focusTab={(tabId) => props.focusTab(props.pane.id, tabId)}
        closeTab={(tabId) => props.closeTab(props.pane.id, tabId)}
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
        <TimelineTab tabId={active.id} relaySets={props.relaySets} />
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
      {:else if active.kind === 'post-manager'}
        <PostManagerTab
          accounts={props.accounts}
          postNodes={props.postNodes}
          createDraft={props.createDraft}
          refresh={props.refreshData}
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
      {:else if active.kind === 'composer'}
        <ComposerTab />
      {:else if active.kind === 'thread'}
        <ThreadTab eventId={String(active.config.eventId ?? '')} />
      {/if}
    </div>
  {/if}
</section>
