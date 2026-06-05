<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import AccountManagerTab from '$lib/tabs/accounts/AccountManagerTab.svelte';
  import LkjstrLogTab from '$lib/tabs/log/LkjstrLogTab.svelte';
  import NpubMinerTab from '$lib/tabs/npub-miner/NpubMinerTab.svelte';
  import ProfileEditTab from '$lib/tabs/profile-edit/ProfileEditTab.svelte';
  import RelaySettingsTab from '$lib/tabs/relays/RelaySettingsTab.svelte';
  import SettingsTab from '$lib/tabs/settings/SettingsTab.svelte';
  import NetworkStatsTab from '$lib/tabs/stats/NetworkStatsTab.svelte';
  import TweetTab from '$lib/tabs/tweet/TweetTab.svelte';
  import UploadSettingsTab from '$lib/tabs/upload-settings/UploadSettingsTab.svelte';
  import WelcomeTab from '$lib/tabs/welcome/WelcomeTab.svelte';
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';

  type Props = {
    tab: WorkspaceTab;
    visible?: boolean;
    restoreSnapshot?: TabSnapshotPayload;
    restoreScrollTop?: number;
    accounts: Account[];
    activeAccount?: Account;
    relaySets: RelaySet[];
    addMinedSigning: (nsec: string) => Promise<void>;
    refreshData: () => void;
    removeRelay: (setId: string, url: string) => void;
    openTool: (paneId: string, kind: TabKind) => void;
    paneId: string;
  };

  let props: Props = $props();
</script>

{#if props.tab.kind === 'account-manager'}
  <AccountManagerTab
    accounts={props.accounts}
    activeAccount={props.activeAccount}
    refreshData={props.refreshData}
  />
{:else if props.tab.kind === 'npub-miner'}
  <NpubMinerTab addMinedSigning={props.addMinedSigning} />
{:else if props.tab.kind === 'profile-edit'}
  <ProfileEditTab
    tabId={props.tab.id}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
  />
{:else if props.tab.kind === 'upload-settings'}
  <UploadSettingsTab />
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
  <SettingsTab
    tabId={props.tab.id}
    visible={props.visible}
    restoreSnapshot={props.restoreSnapshot}
    restoreScrollTop={props.restoreScrollTop}
  />
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
