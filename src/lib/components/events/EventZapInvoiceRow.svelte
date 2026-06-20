<script lang="ts">
  import { Copy, ExternalLink } from '@lucide/svelte';
  import type { EventZapInvoiceRowPlan } from './event-zap-row-plan';

  type Props = {
    row: EventZapInvoiceRowPlan;
    copyInvoice: (invoice: string) => unknown;
    openInvoice: (uri: string) => unknown;
  };

  let props: Props = $props();

  function copyRowInvoice(): void {
    void props.copyInvoice(props.row.invoice);
  }
</script>

<section class="zap-invoice">
  <img src={props.row.qrDataUrl} alt={props.row.qrAlt} />
  <div class="zap-invoice__controls">
    <span>{props.row.amountLabel}</span>
    <button
      type="button"
      class="icon-button"
      aria-label={props.row.openLabel}
      title={props.row.openLabel}
      onclick={() => props.openInvoice(props.row.uri)}
    >
      <ExternalLink size={16} />
    </button>
    <button
      type="button"
      class="icon-button"
      aria-label={props.row.copyLabel}
      title={props.row.copyLabel}
      onclick={copyRowInvoice}
    >
      <Copy size={16} />
    </button>
  </div>
</section>
