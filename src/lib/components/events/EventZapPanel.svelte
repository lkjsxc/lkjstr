<script lang="ts">
  import { Copy, ExternalLink } from '@lucide/svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { createZapInvoices, type ZapInvoice } from '$lib/events/zap';

  type Props = {
    event: NostrEvent;
    profile?: ProfileSummary;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let amount = $state(21);
  let message = $state('');
  let status = $state('');
  let busy = $state(false);
  let invoices = $state<ZapInvoice[]>([]);

  async function createInvoices(): Promise<void> {
    busy = true;
    status = '';
    invoices = [];
    try {
      invoices = await createZapInvoices({
        event: props.event,
        profile: props.profile,
        relaySets: props.relaySets,
        amountSats: amount,
        message,
      });
      status = invoices.length === 1 ? 'Invoice ready.' : 'Invoices ready.';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Zap failed.';
    } finally {
      busy = false;
    }
  }
</script>

<form
  class="event-inline-action event-inline-action--zap"
  onsubmit={(event) => {
    event.preventDefault();
    void createInvoices();
  }}
>
  <input
    aria-label="Zap amount sats"
    type="number"
    min="1"
    bind:value={amount}
  />
  <input aria-label="Zap message" bind:value={message} />
  <button class="compact-button" type="submit" disabled={busy || amount < 1}>
    Invoice
  </button>
</form>
{#if invoices.length > 0}
  <div class="zap-invoices">
    {#each invoices as invoice (invoice.invoice)}
      <section class="zap-invoice">
        <img src={invoice.qrDataUrl} alt="BOLT11 invoice QR code" />
        <div class="zap-invoice__controls">
          <span>{Math.floor(invoice.amountMsats / 1000)} sats</span>
          <button
            type="button"
            class="icon-button"
            aria-label="Open invoice"
            title="Open invoice"
            onclick={() => window.open(invoice.uri, '_blank')}
          >
            <ExternalLink size={16} />
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="Copy invoice"
            title="Copy invoice"
            onclick={() => navigator.clipboard?.writeText(invoice.invoice)}
          >
            <Copy size={16} />
          </button>
        </div>
      </section>
    {/each}
  </div>
{/if}
{#if status}<p class="event-action-status" role="status">{status}</p>{/if}
