<script lang="ts">
  import { onMount } from 'svelte';
  import {
    readStoragePersistenceState,
    requestStoragePersistence,
    type StoragePersistenceRequest,
    type StoragePersistenceState,
  } from '$lib/storage/persistent-storage';

  let persistenceState = $state<StoragePersistenceState>({
    supported: false,
    persisted: null,
  });
  let request = $state<StoragePersistenceRequest | null>(null);
  let busy = $state(false);

  onMount(() => {
    void refresh();
  });

  async function refresh(): Promise<void> {
    persistenceState = await readStoragePersistenceState();
  }

  async function requestPersistence(): Promise<void> {
    if (busy) return;
    busy = true;
    request = await requestStoragePersistence();
    persistenceState = {
      supported: request.supported,
      persisted: request.persisted,
    };
    busy = false;
  }

  function label(): string {
    if (!persistenceState.supported) return 'unsupported';
    if (persistenceState.persisted === true) return 'already persisted';
    if (request?.granted === true) return 'granted';
    if (request?.granted === false) return 'denied';
    if (request?.reason === 'failed') return 'failed';
    return 'not persisted';
  }
</script>

<section class="account-storage-safety" aria-label="Account storage safety">
  <p>
    Local account records and local signing secrets are browser-owned IndexedDB
    data. Cache cleanup never deletes them. Browser persistent storage can
    reduce eviction risk when supported.
  </p>
  <div class="toolbar">
    <span>Storage persistence: {label()}</span>
    <button
      type="button"
      disabled={
        busy || !persistenceState.supported || persistenceState.persisted === true
      }
      onclick={() => void requestPersistence()}
    >
      Request persistence
    </button>
  </div>
</section>
