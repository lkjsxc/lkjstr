<script lang="ts">
  import type { CacheMetadata } from '$lib/cache/cache-status';
  import { enforceCacheBudget } from '$lib/cache/cache-budget-enforcement';
  import { repairCacheLedger } from '$lib/cache/cache-ledger-repair';
  import { browserDb } from '$lib/storage/browser-db';

  type Props = {
    cache: CacheMetadata | null;
    refresh: () => Promise<void>;
  };

  const props: Props = $props();

  async function compactNow(): Promise<void> {
    await enforceCacheBudget('manual', { maxBytes: await cacheBudgetBytes() });
    await props.refresh();
  }

  async function repairLedger(): Promise<void> {
    await repairCacheLedger();
    await props.refresh();
  }

  async function cacheBudgetBytes(): Promise<number | undefined> {
    const row = await browserDb().settings.get('cache.maxBytes');
    return typeof row?.value === 'number'
      ? row.value
      : props.cache?.budgetBytes;
  }
</script>

<button type="button" onclick={() => void props.refresh()}>
  Refresh storage inventory
</button>
<button type="button" onclick={() => void compactNow()}>Compact now</button>
<button type="button" onclick={() => void repairLedger()}>
  Repair cache ledger
</button>
