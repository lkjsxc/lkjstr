<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { selectedDefaultRelaySet } from '$lib/relays/relay-store';

  type Props = {
    accounts: readonly Account[];
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let defaultSet = $derived(selectedDefaultRelaySet(props.relaySets));
  let readRelays = $derived(
    defaultSet?.relays.filter((relay) => relay.enabled && relay.read) ?? [],
  );
  let writeRelays = $derived(
    defaultSet?.relays.filter((relay) => relay.enabled && relay.write) ?? [],
  );
</script>

<section class="data-tab welcome-tab" aria-label="Welcome">
  <h2>Welcome</h2>
  <dl class="metric-list">
    <dt>Active account</dt>
    <dd>{props.activeAccount?.label ?? 'none'}</dd>
    <dt>Accounts</dt>
    <dd>{props.accounts.length}</dd>
    <dt>Relay set</dt>
    <dd>{defaultSet?.name ?? 'none'}</dd>
    <dt>Read relays</dt>
    <dd>{readRelays.length}</dd>
    <dt>Write relays</dt>
    <dd>{writeRelays.length}</dd>
  </dl>
  {#if !props.activeAccount}
    <p>Accounts is open on the right so you can choose or add an identity.</p>
  {:else if readRelays.length === 0}
    <p>Relay Settings is open on the right so you can enable read relays.</p>
  {:else}
    <p>Home, Notifications, Search, and Tweet are ready in the workspace.</p>
  {/if}
</section>
