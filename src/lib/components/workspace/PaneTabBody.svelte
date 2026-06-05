<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import NewTab from '$lib/tabs/new-tab/NewTab.svelte';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';
  import PaneFeedTabBody from './PaneFeedTabBody.svelte';
  import PaneToolTabBody from './PaneToolTabBody.svelte';

  type Props = {
    tab: WorkspaceTab;
    visible: boolean;
    paneId: string;
    restoreAnchor?: TabFeedAnchor;
    restoreSnapshot?: TabSnapshotPayload;
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

  const feedKinds = new Set<TabKind>([
    'timeline',
    'global',
    'search',
    'custom-request',
    'notifications',
    'author-context',
    'profile',
    'thread',
  ]);
  const toolKinds = new Set<TabKind>([
    'account-manager',
    'npub-miner',
    'profile-edit',
    'upload-settings',
    'relay-monitor',
    'relay-settings',
    'network-stats',
    'settings',
    'tweet',
    'welcome',
  ]);
</script>

{#if props.tab.kind === 'new-tab'}
  <NewTab
    tabId={props.tab.id}
    activeAccountPubkey={props.activeAccount?.pubkey}
    convert={props.convertTab}
  />
{:else if feedKinds.has(props.tab.kind)}
  <PaneFeedTabBody
    tab={props.tab}
    visible={props.visible}
    paneId={props.paneId}
    restoreAnchor={props.restoreAnchor}
    restoreSnapshot={props.restoreSnapshot}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    pageDataReady={props.pageDataReady}
    openProfile={props.openProfile}
    openProfileEdit={props.openProfileEdit}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
{:else if toolKinds.has(props.tab.kind)}
  <PaneToolTabBody
    tab={props.tab}
    visible={props.visible}
    restoreSnapshot={props.restoreSnapshot}
    restoreScrollTop={props.restoreScrollTop}
    accounts={props.accounts}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    addMinedSigning={props.addMinedSigning}
    refreshData={props.refreshData}
    removeRelay={props.removeRelay}
    openTool={props.openTool}
    paneId={props.paneId}
  />
{/if}
