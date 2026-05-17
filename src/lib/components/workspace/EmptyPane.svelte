<script lang="ts">
  import type { TabKind } from '$lib/workspace/tab';

  type Props = {
    paneId: string;
    openTab: (paneId: string | null, kind: TabKind) => void;
    split: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  };

  let props: Props = $props();
  const tabKinds: readonly [TabKind, string][] = [
    ['timeline', 'Open Timeline'],
    ['notifications', 'Open Notifications'],
    ['profile', 'Open Profile'],
    ['account-manager', 'Open Account Manager'],
    ['post-manager', 'Open Post Manager'],
    ['relay-monitor', 'Open Relay Monitor'],
    ['composer', 'Open Composer'],
    ['settings', 'Open Settings'],
  ];
</script>

<section class="empty-pane" aria-label="Empty pane">
  <h2>Empty pane</h2>
  <div class="empty-actions">
    {#each tabKinds as [kind, label] (kind)}
      <button type="button" onclick={() => props.openTab(props.paneId, kind)}>
        {label}
      </button>
    {/each}
    <button
      type="button"
      onclick={() => props.split(props.paneId, 'horizontal')}
    >
      Split Right
    </button>
    <button type="button" onclick={() => props.split(props.paneId, 'vertical')}>
      Split Down
    </button>
  </div>
</section>
