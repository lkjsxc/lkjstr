<script lang="ts">
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { createZapInvoices, type ZapInvoice } from '$lib/events/zap';
  import { copyEventZapInvoiceStatus } from '$lib/components/events/zap-copy-status';
  import { eventZapPanelLabels } from './event-zap-panel-plan';
  import {
    eventZapInvoiceRows,
    hasEventZapInvoices,
    openEventZapInvoice,
  } from './event-zap-row-plan';
  import {
    canSubmitEventZap,
    runEventZapSubmit,
    submitEventZap,
  } from './event-zap-submit-plan';
  import EventZapInvoiceRow from './EventZapInvoiceRow.svelte';

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

  function invoiceRows() {
    return eventZapInvoiceRows(invoices, labels);
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
{#if hasEventZapInvoices(invoices)}
  <div class="zap-invoices">
    {#each invoiceRows() as invoice (invoice.key)}
      <EventZapInvoiceRow row={invoice} {copyInvoice} {openInvoice} />
    {/each}
  </div>
{/if}
{#if status}<p class="event-action-status" role="status">{status}</p>{/if}
