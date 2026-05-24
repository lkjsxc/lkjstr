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
  let setupStatus = $derived(
    !props.activeAccount
      ? 'Choose or add a signing identity in Accounts.'
      : readRelays.length === 0
        ? 'Enable at least one read relay in Relay Settings.'
        : 'Core reading and publishing surfaces are ready.',
  );
  let coreSurfaces = [
    ['Accounts', 'Local signing identities and active-account selection.'],
    ['Relay Settings', 'User-owned read and write relay configuration.'],
    ['Home', 'Active-account follows and live notes.'],
    ['Notifications', 'Mentions, reactions, reposts, and zap activity.'],
    ['Search', 'Cached content matches and relay NIP-50 queries.'],
    ['Tweet', 'Compose notes, replies, media, and event actions.'],
    ['lkjstr Log', 'Current-session relay and runtime diagnostics.'],
  ] as const;
</script>

<section class="data-tab welcome-tab" aria-label="Welcome">
  <section class="option-card">
    <h2>Quick start</h2>
    <p>{setupStatus}</p>
  </section>

  <dl class="metric-list">
    <dt>Setup</dt>
    <dd>
      {readRelays.length > 0 && props.activeAccount ? 'ready' : 'needs setup'}
    </dd>
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

  <section class="option-card">
    <h2>lkjstr</h2>
    <p>
      lkjstr is a browser-first Nostr workspace for reading timelines, composing
      notes, inspecting relay behavior, managing signing accounts, and following
      event threads without a server-side account system.
    </p>
  </section>

  <section class="option-grid" aria-label="Core surfaces">
    {#each coreSurfaces as [name, description] (name)}
      <article class="option-card">
        <strong>{name}</strong>
        <span>{description}</span>
      </article>
    {/each}
  </section>
</section>
