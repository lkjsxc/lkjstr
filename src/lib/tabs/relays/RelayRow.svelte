<script lang="ts">
  import { relayDiagnosticDisplayMessage } from '$lib/relays/relay-diagnostic-display';
  import type { RelayDiagnosticSummary } from '$lib/relays/relay-diagnostic-summary';
  import type { RelayInformationRecord } from '$lib/relays/relay-info';
  import type { RelayPurpose } from '$lib/relays/relay-purpose';
  import type { RelayRecord } from '$lib/relays/relay-store';
  import type { RelaySnapshot } from '$lib/relays/types';
  import RelayInfoDetails from './RelayInfoDetails.svelte';

  type PatchKey = 'label' | 'enabled' | 'read' | 'write';

  type Props = {
    setId: string;
    purpose: RelayPurpose;
    relay: RelayRecord;
    snapshot?: RelaySnapshot;
    information?: RelayInformationRecord;
    summary?: RelayDiagnosticSummary;
    patch: (
      setId: string,
      url: string,
      key: PatchKey,
      value: unknown,
    ) => void | Promise<void>;
    removeRelay: (setId: string, url: string) => void;
    fetchInfo: (url: string) => void;
  };

  let props: Props = $props();

  function formatTime(timestamp?: number): string {
    return timestamp ? new Date(timestamp).toLocaleString() : 'never';
  }
</script>

<div class="row">
  <input
    aria-label={`Label ${props.relay.url}`}
    id={`relay-label-${props.setId}-${props.relay.url}`}
    name={`relay-label-${props.setId}-${props.relay.url}`}
    value={props.relay.label}
    onblur={(event) =>
      props.patch(
        props.setId,
        props.relay.url,
        'label',
        event.currentTarget.value,
      )}
  />
  <small>{props.relay.url}</small>
  <label>
    <input
      checked={props.relay.enabled}
      id={`relay-enabled-${props.setId}-${props.relay.url}`}
      name={`relay-enabled-${props.setId}-${props.relay.url}`}
      type="checkbox"
      onchange={(event) =>
        props.patch(
          props.setId,
          props.relay.url,
          'enabled',
          event.currentTarget.checked,
        )}
    />
    enabled
  </label>
  {#if props.purpose === 'user'}
    {#each ['read', 'write'] as key (key)}
      <label>
        <input
          checked={props.relay[key as 'read']}
          id={`relay-${key}-${props.setId}-${props.relay.url}`}
          name={`relay-${key}-${props.setId}-${props.relay.url}`}
          type="checkbox"
          onchange={(event) =>
            props.patch(
              props.setId,
              props.relay.url,
              key as 'read' | 'write',
              event.currentTarget.checked,
            )}
        />
        {key}
      </label>
    {/each}
  {/if}
  <small>{props.snapshot?.state ?? props.relay.state}</small>
  <RelayInfoDetails record={props.information} />
  <small>
    {props.relay.health.attempts} attempts · {props.relay.health.successes} ok · {props
      .relay.health.failures} failed
  </small>
  {#if props.summary}
    <small>
      persisted events {props.summary.validEventCount} · last
      {props.summary.lastEventId ?? 'none'}
    </small>
  {/if}
  <small>last connected {formatTime(props.relay.lastConnectedAt)}</small>
  {#if props.snapshot?.lastError}
    <small>
      {relayDiagnosticDisplayMessage(props.snapshot.lastError)}
    </small>
  {:else if props.relay.lastError}
    <small>{relayDiagnosticDisplayMessage(props.relay.lastError)}</small>
  {/if}
  <button
    type="button"
    onclick={() => props.removeRelay(props.setId, props.relay.url)}
  >
    Remove
  </button>
  <button type="button" onclick={() => props.fetchInfo(props.relay.url)}>
    Fetch info
  </button>
</div>
