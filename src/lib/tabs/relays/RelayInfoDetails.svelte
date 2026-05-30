<script lang="ts">
  import type { RelayInformationRecord } from '$lib/relays/relay-info';

  type Props = {
    record?: RelayInformationRecord;
  };

  let props: Props = $props();
  let info = $derived(props.record?.info);
  let limitation = $derived(info?.limitation);
  let stale = $derived(
    props.record ? Date.now() - props.record.fetchedAt > 30 * 60 * 1000 : false,
  );
  let limits = $derived(
    limitation
      ? [
          field('max limit', limitation.maxLimit),
          field('default limit', limitation.defaultLimit),
          field('message bytes', limitation.maxMessageLength),
          field('subscriptions', limitation.maxSubscriptions),
          field('sub id bytes', limitation.maxSubIdLength),
          field('event tags', limitation.maxEventTags),
          field('content bytes', limitation.maxContentLength),
        ].filter(Boolean)
      : [],
  );
  let policies = $derived(
    limitation
      ? [
          limitation.authRequired ? 'auth required' : '',
          limitation.paymentRequired ? 'payment required' : '',
          limitation.restrictedWrites ? 'restricted writes' : '',
          limitation.minPowDifficulty
            ? `pow ${limitation.minPowDifficulty}`
            : '',
          limitation.createdAtLowerLimit
            ? `created after ${limitation.createdAtLowerLimit}`
            : '',
          limitation.createdAtUpperLimit
            ? `created before ${limitation.createdAtUpperLimit}`
            : '',
        ].filter(Boolean)
      : [],
  );

  function field(label: string, value: number | undefined): string {
    return value === undefined ? '' : `${label} ${value}`;
  }
</script>

{#if props.record?.status === 'available'}
  <small>
    {info?.name ?? 'NIP-11'}
    {info?.software ?? ''}
    {stale ? 'stale' : 'available'}
  </small>
  {#if info?.version}
    <small>{info.version}</small>
  {/if}
  <small>NIPs {(info?.supported_nips ?? []).join(', ') || 'unknown'}</small>
  {#if info?.description}<small>{info.description}</small>{/if}
  {#if limits.length}
    <small>limits {limits.join(' · ')}</small>
  {/if}
  {#if policies.length}
    <small>policy {policies.join(' · ')}</small>
  {/if}
  {#if info?.contact}<small>contact {info.contact}</small>{/if}
  {#if info?.terms_of_service}
    <small>terms {info.terms_of_service}</small>
  {/if}
  {#if info?.payments_url}<small>payment {info.payments_url}</small>{/if}
  {#if info?.icon}<small>icon {info.icon}</small>{/if}
  {#if info?.banner}<small>banner {info.banner}</small>{/if}
{:else if props.record?.status === 'unavailable'}
  <small>NIP-11 unavailable: {props.record.error}</small>
{:else}
  <small>NIP-11 not fetched</small>
{/if}
