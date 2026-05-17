<script lang="ts">
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { Account } from '$lib/accounts/account';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import type { WorkspacePaneNode } from '$lib/workspace/pane';
  import type { TabGroup } from '$lib/workspace/tab-group';
  import type { WorkspaceTab, TabKind } from '$lib/workspace/tab';
  import TabStrip from './TabStrip.svelte';

  type Props = {
    pane: WorkspacePaneNode;
    group: TabGroup;
    tabs: Record<string, WorkspaceTab>;
    accounts: Account[];
    notifications: NotificationRecord[];
    postNodes: PostTreeNode[];
    focusTab: (paneId: string, tabId: string) => void;
    closeTab: (paneId: string, tabId: string) => void;
    openTab: (paneId: string, kind: TabKind) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    addReadonly: () => void;
    addNip07: () => void;
    createDraft: () => void;
  };

  let props: Props = $props();
  let active = $derived(props.tabs[props.group.activeTabId]);
</script>

<section class="pane" aria-label="Workspace pane">
  <header class="pane-head">
    <TabStrip
      group={props.group}
      tabs={props.tabs}
      focusTab={(tabId) => props.focusTab(props.pane.id, tabId)}
      closeTab={(tabId) => props.closeTab(props.pane.id, tabId)}
    />
    <nav>
      <button
        type="button"
        onclick={() => props.split(props.pane.id, 'horizontal')}
        >Split right</button
      >
      <button
        type="button"
        onclick={() => props.split(props.pane.id, 'vertical')}
        >Split down</button
      >
    </nav>
  </header>

  {#if active}
    <div class="pane-body">
      {#if active.kind === 'timeline'}
        <h2>{active.title}</h2>
        <p>Timeline events render here from cache first, then relay updates.</p>
      {:else if active.kind === 'account-manager'}
        <h2>Accounts</h2>
        <div class="toolbar">
          <button type="button" onclick={props.addReadonly}
            >Add read-only</button
          >
          <button type="button" onclick={props.addNip07}>Add NIP-07</button>
        </div>
        {#each props.accounts as account (account.id)}
          <article class="row">
            <IdentityChip pubkey={account.pubkey} />
            <small>{account.signerType}</small>
          </article>
        {:else}
          <p>No accounts yet.</p>
        {/each}
      {:else if active.kind === 'notifications'}
        <h2>Notifications</h2>
        {#each props.notifications as notification (notification.id)}
          <article class="row">
            <IdentityChip pubkey={notification.actorPubkey} compact />
            <small>{notification.kind}</small>
          </article>
        {:else}
          <p>No notifications indexed for the active account.</p>
        {/each}
      {:else if active.kind === 'profile'}
        <h2>Profile</h2>
        <IdentityChip pubkey={String(active.config.pubkey ?? '')} />
        <p>
          User timeline, replies, media, relay list, and raw metadata share this
          tab.
        </p>
      {:else if active.kind === 'post-manager'}
        <h2>Post Manager</h2>
        <button type="button" onclick={props.createDraft}>New draft</button>
        {#each props.postNodes as node (node.id)}
          <article class="row">
            <strong>{node.title}</strong>
            <small>{node.status}</small>
          </article>
        {:else}
          <p>No draft tree nodes yet.</p>
        {/each}
      {:else if active.kind === 'relay-monitor'}
        <h2>Relays</h2>
        <p>
          Relay health, subscription counts, publish results, and auth state
          render here.
        </p>
      {:else if active.kind === 'cache-status'}
        <h2>Cache</h2>
        <p>
          Storage usage, compaction, and memory-pressure counters render here.
        </p>
      {:else}
        <h2>{active.title}</h2>
        <p>This tab kind is registered and ready for a typed runtime.</p>
      {/if}
    </div>
  {/if}

  <footer class="pane-tabs">
    <button
      type="button"
      onclick={() => props.openTab(props.pane.id, 'timeline')}>Timeline</button
    >
    <button
      type="button"
      onclick={() => props.openTab(props.pane.id, 'notifications')}
      >Notifications</button
    >
    <button
      type="button"
      onclick={() => props.openTab(props.pane.id, 'profile')}>Profile</button
    >
    <button
      type="button"
      onclick={() => props.openTab(props.pane.id, 'post-manager')}>Posts</button
    >
    <button
      type="button"
      onclick={() => props.openTab(props.pane.id, 'relay-monitor')}
      >Relays</button
    >
  </footer>
</section>
