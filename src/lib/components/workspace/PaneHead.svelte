<script lang="ts">
  import type { TabKind, WorkspaceTab } from '$lib/workspace/tab';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import NewTabButton from './NewTabButton.svelte';
  import TabStrip from './TabStrip.svelte';
  import TileMenu from './TileMenu.svelte';

  type Props = {
    paneId: string;
    group?: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    ready: boolean;
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    moveTab: (
      sourcePaneId: string,
      targetPaneId: string,
      tabId: string,
      targetIndex: number,
      edge?: 'left' | 'right' | 'top' | 'bottom',
    ) => void;
    openNewTab: (paneId: string) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    closePane: (paneId: string) => void;
  };

  let props: Props = $props();
</script>

<header class="pane-head">
  <div class="pane-actions">
    <TileMenu
      split={(direction) => props.split(props.paneId, direction)}
      closePane={() => props.closePane(props.paneId)}
      disabled={!props.ready}
    />
    <NewTabButton
      open={() => props.openNewTab(props.paneId)}
      disabled={!props.ready}
    />
  </div>
  {#if props.group}
    <TabStrip
      group={props.group}
      paneId={props.paneId}
      tabs={props.tabs}
      focusTab={(tabId) => props.focusTab(props.paneId, tabId)}
      closeTab={(tabId) => props.closeTab(props.paneId, tabId)}
      moveTab={props.moveTab}
      disabled={!props.ready}
    />
  {/if}
</header>
