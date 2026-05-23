<script lang="ts">
  import type { RelayInformationRecord } from '$lib/relays/relay-info';

  type Props = {
    record?: RelayInformationRecord;
  };

  let props: Props = $props();
  let info = $derived(props.record?.info);
</script>

{#if props.record?.status === 'available'}
  <small>{info?.name ?? 'NIP-11'} {info?.software ?? ''}</small>
  <small>NIPs {(info?.supported_nips ?? []).join(', ') || 'unknown'}</small>
  {#if info?.description}<small>{info.description}</small>{/if}
  {#if info?.limitation}
    <small>limits {JSON.stringify(info.limitation)}</small>
  {/if}
  {#if info?.contact}<small>contact {info.contact}</small>{/if}
  {#if info?.icon}<small>icon {info.icon}</small>{/if}
  {#if info?.banner}<small>banner {info.banner}</small>{/if}
{:else if props.record?.status === 'unavailable'}
  <small>NIP-11 unavailable: {props.record.error}</small>
{:else}
  <small>NIP-11 not fetched</small>
{/if}
