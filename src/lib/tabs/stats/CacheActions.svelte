<script lang="ts">
  import type { CacheMetadata } from '$lib/cache/cache-status';
  import { enforceCacheBudget } from '$lib/cache/cache-budget-enforcement';
  import { repairCacheLedger } from '$lib/cache/cache-ledger-repair';
  import { cacheActionBudgetBytes } from './cache-action-budget';

  type Props = {
    cache: CacheMetadata | null;
    refresh: () => Promise<void>;
  };

  const props: Props = $props();

  async function compactNow(): Promise<void> {
    await enforceCacheBudget('manual', {
      maxBytes: await cacheActionBudgetBytes(props.cache?.budgetBytes),
    });
    await props.refresh();
  }

  async function repairLedger(): Promise<void> {
    await repairCacheLedger();
    await props.refresh();
  }
</script>

<button type="button" onclick={() => void props.refresh()}>
  Refresh storage inventory
</button>
<button type="button" onclick={() => void compactNow()}>Compact now</button>
<button type="button" onclick={() => void repairLedger()}>
  Repair storage
</button>
