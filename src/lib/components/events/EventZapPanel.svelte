<script lang="ts">
  import { Copy, ExternalLink } from '@lucide/svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { createZapInvoices, type ZapInvoice } from '$lib/events/zap';
  import { copyEventZapInvoiceStatus } from '$lib/components/events/zap-copy-status';
  import {
    canSubmitEventZap,
    eventZapPanelLabels,
    openEventZapInvoice,
    runEventZapSubmit,
    submitEventZap,
    zapInvoiceAmountSats,
  } from './event-zap-panel-plan';

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
  const labels = eventZapPanelLabels();

  async function createInvoices(): Promise<void> {
    await runEventZapSubmit({
      createInvoices: () =>
        createZapInvoices({
          event: props.event,
          profile: props.profile,
          relaySets: props.relaySets,
          amountSats: amount,
          message,
        }),
      setBusy: (next) => (busy = next),
      setInvoices: (next) => (invoices = [...next]),
      setStatus: (next) => (status = next),
    });
  }

  async function copyInvoice(invoice: string): Promise<void> {
    await copyEventZapInvoiceStatus(invoice, {
      clipboard: navigator.clipboard,
      setStatus: (next) => (status = next),
    });
  }

  function openInvoice(uri: string): void {
    openEventZapInvoice(uri, (url, target) => window.open(url, target));
  }
</script>

<form
  class="event-inline-action event-inline-action--zap"
  onsubmit={(event) => submitEventZap(event, () => void createInvoices())}
>
  <input
    aria-label={labels.amountInput}
    type="number"
    min="1"
    bind:value={amount}
  />
  <input aria-label={labels.messageInput} bind:value={message} />
  <button
    class="compact-button"
    type="submit"
    disabled={!canSubmitEventZap(amount, busy)}
  >
    {labels.submit}
  </button>
</form>
{#if invoices.length > 0}
  <div class="zap-invoices">
    {#each invoices as invoice (invoice.invoice)}
      <section class="zap-invoice">
        <img src={invoice.qrDataUrl} alt={labels.invoiceQrAlt} />
        <div class="zap-invoice__controls">
          <span>{zapInvoiceAmountSats(invoice.amountMsats)} sats</span>
          <button
            type="button"
            class="icon-button"
            aria-label={labels.openInvoice}
            title={labels.openInvoice}
            onclick={() => openInvoice(invoice.uri)}
          >
            <ExternalLink size={16} />
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label={labels.copyInvoice}
            title={labels.copyInvoice}
            onclick={() => {
              void copyInvoice(invoice.invoice);
            }}
          >
            <Copy size={16} />
          </button>
        </div>
      </section>
    {/each}
  </div>
{/if}
{#if status}<p class="event-action-status" role="status">{status}</p>{/if}
