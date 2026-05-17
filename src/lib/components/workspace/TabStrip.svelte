<script lang="ts">
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { WorkspaceTab } from '$lib/workspace/tab';

  type Props = {
    group: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    focusTab: (tabId: string) => void;
    closeTab: (tabId: string) => void;
  };

  let { group, tabs, focusTab, closeTab }: Props = $props();
</script>

<div class="tab-strip" role="tablist">
  {#each group.tabIds as tabId (tabId)}
    {@const tab = tabs[tabId]}
    {#if tab}
      <button
        type="button"
        role="tab"
        class:active={group.activeTabId === tab.id}
        onclick={() => focusTab(tab.id)}
      >
        <span>{tab.title}</span>
        {#if tab.unreadCount}
          <small>{tab.unreadCount}</small>
        {/if}
      </button>
      <button
        type="button"
        class="icon"
        aria-label={`Close ${tab.title}`}
        onclick={() => closeTab(tab.id)}
      >
        x
      </button>
    {/if}
  {/each}
</div>
