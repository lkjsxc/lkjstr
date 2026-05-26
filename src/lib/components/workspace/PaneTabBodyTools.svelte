<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import LkjstrLogTab from '$lib/tabs/log/LkjstrLogTab.svelte';
  import RelaySettingsTab from '$lib/tabs/relays/RelaySettingsTab.svelte';
  import SettingsTab from '$lib/tabs/settings/SettingsTab.svelte';
  import NetworkStatsTab from '$lib/tabs/stats/NetworkStatsTab.svelte';
  import TweetTab from '$lib/tabs/tweet/TweetTab.svelte';
  import WelcomeTab from '$lib/tabs/welcome/WelcomeTab.svelte';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';

  type Props = {
    tab: WorkspaceTab;
    restoreScrollTop?: number;
    accounts: Account[];
    activeAccount?: Account;
    relaySets: RelaySet[];
    refreshData: () => void;
    removeRelay: (setId: string, url: string) => void;
    openTool: (paneId: string, kind: TabKind) => void;
    paneId: string;
  };

  let props: Props = $props();
</script>

{#if props.tab.kind === 'relay-monitor'}
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
  <SettingsTab tabId={props.tab.id} restoreScrollTop={props.restoreScrollTop} />
{:else if props.tab.kind === 'tweet'}
  <TweetTab
    tabId={props.tab.id}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
  />
{:else if props.tab.kind === 'welcome'}
  <WelcomeTab
    accounts={props.accounts}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    openTool={(kind) => props.openTool(props.paneId, kind)}
  />
{/if}
