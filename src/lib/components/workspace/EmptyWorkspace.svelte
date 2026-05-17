<script lang="ts">
  import type { TabKind } from '$lib/workspace/tab';

  type Props = {
    openTab: (paneId: string | null, kind: TabKind) => void;
    restoreWorkspace: () => void;
    addReadonly: () => void;
  };

  let props: Props = $props();
</script>

<section class="empty-workspace" aria-label="Empty workspace">
  <h2>Empty workspace</h2>
  <div class="empty-actions">
    <button type="button" onclick={() => props.openTab(null, 'timeline')}>
      Open Timeline
    </button>
    <button
      type="button"
      onclick={() => props.openTab(null, 'account-manager')}
    >
      Open Account Manager
    </button>
    <button type="button" onclick={() => props.openTab(null, 'settings')}>
      Open Settings
    </button>
    <button type="button" onclick={props.restoreWorkspace}>
      Restore Default Workspace
    </button>
    <button type="button" onclick={props.addReadonly}>Add Account</button>
    <button type="button" onclick={() => props.openTab(null, 'relay-monitor')}>
      Open Relay Monitor
    </button>
  </div>
</section>
