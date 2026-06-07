<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { selectedDefaultRelaySet } from '$lib/relays/relay-store';
  import type { TabKind } from '$lib/workspace/tab';

  type Props = {
    accounts: readonly Account[];
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    openTool: (kind: TabKind) => void;
  };

  let props: Props = $props();
  let defaultSet = $derived(selectedDefaultRelaySet(props.relaySets));
  let readRelays = $derived(
    defaultSet?.relays.filter((relay) => relay.enabled && relay.read) ?? [],
  );
  let writeRelays = $derived(
    defaultSet?.relays.filter((relay) => relay.enabled && relay.write) ?? [],
  );
  let accountReady = $derived(Boolean(props.activeAccount));
  let relayReady = $derived(readRelays.length > 0);
  let postReady = $derived(accountReady && writeRelays.length > 0);
</script>

<section class="data-tab form-tab welcome-tab" aria-label="Welcome">
  <article class="welcome-doc">
    <h2>What this workspace is</h2>
    <p>
      lkjstr is a browser-first Nostr workspace for reading timelines, composing
      notes, inspecting relay behavior, managing signing accounts, and following
      threads without a server-side account system.
    </p>
  </article>

  <article class="welcome-doc">
    <h2>How to configure accounts</h2>
    <p>
      {accountReady
        ? `Active account: ${props.activeAccount?.label ?? 'selected'}.`
        : 'No active signing account is selected yet.'}
    </p>
    <button type="button" onclick={() => props.openTool('account-manager')}>
      Open Accounts
    </button>
  </article>

  <article class="welcome-doc">
    <h2>How to configure relays</h2>
    <p>
      {relayReady
        ? `${readRelays.length} read relay(s) and ${writeRelays.length} write relay(s) are enabled in the selected set.`
        : 'Enable at least one read relay in the selected relay set.'}
    </p>
    <button type="button" onclick={() => props.openTool('relay-settings')}>
      Open Relay Settings
    </button>
  </article>

  <article class="welcome-doc">
    <h2>How to post</h2>
    <p>
      {postReady
        ? 'Compose notes from Tweet after choosing an account and write relays.'
        : 'Select an account and enable write relays before publishing.'}
    </p>
    <button type="button" onclick={() => props.openTool('tweet')}>
      Open Tweet
    </button>
  </article>

  <article class="welcome-doc">
    <h2>Core surfaces</h2>
    <ul class="welcome-links">
      <li>
        <button type="button" onclick={() => props.openTool('timeline')}>
          Home
        </button>
      </li>
      <li>
        <button type="button" onclick={() => props.openTool('notifications')}>
          Notifications
        </button>
      </li>
      <li>
        <button type="button" onclick={() => props.openTool('global')}>
          Global
        </button>
      </li>
      <li>
        <button type="button" onclick={() => props.openTool('search')}>
          Search
        </button>
      </li>
      <li>
        <button type="button" onclick={() => props.openTool('settings')}>
          Settings
        </button>
      </li>
      <li>
        <button type="button" onclick={() => props.openTool('upload-settings')}>
          Upload Settings
        </button>
      </li>
      <li>
        <button type="button" onclick={() => props.openTool('network-stats')}>
          Stats
        </button>
      </li>
      <li>
        <button type="button" onclick={() => props.openTool('relay-monitor')}>
          lkjstr Log
        </button>
      </li>
    </ul>
  </article>

  <article class="welcome-doc">
    <h2>What is still missing</h2>
    <p>
      Passkey-protected local secrets, encrypted direct messages, and wallet
      custody for zaps remain out of scope. See product backlog and protocol
      support docs for the current boundary.
    </p>
  </article>
</section>
