<script lang="ts">
  import { onMount } from 'svelte';
  import {
    mediaUploadProviders,
    providerServer,
    validCustomUploadServer,
    type MediaUploadProvider,
  } from '$lib/media/providers';
  import { resolveUploadEndpoint } from '$lib/media/endpoint';
  import {
    loadUploadSettings,
    saveUploadCustomServer,
    saveUploadNoTransform,
    saveUploadProvider,
    type UploadSettings,
  } from '$lib/media/settings';

  let settings = $state<UploadSettings>({
    provider: 'nostr-build',
    customServer: '',
    server: 'https://nostr.build',
    noTransform: true,
  });
  let customDraft = $state('');
  let status = $state('');
  let testing = $state(false);
  let customError = $derived(
    validCustomUploadServer(customDraft)
      ? ''
      : 'Custom upload server must be blank or HTTPS.',
  );
  let resolvedServer = $derived(providerServer(settings.provider, customDraft));

  onMount(() => {
    void refresh();
  });

  async function refresh(): Promise<void> {
    settings = await loadUploadSettings();
    customDraft = settings.customServer;
  }

  async function choose(provider: MediaUploadProvider): Promise<void> {
    settings = {
      ...settings,
      provider,
      server: providerServer(provider, customDraft),
    };
    status = '';
    await saveUploadProvider(provider);
  }

  async function saveCustom(): Promise<void> {
    if (customError) return void (status = customError);
    await saveUploadCustomServer(customDraft);
    settings = {
      ...settings,
      customServer: customDraft,
      server: providerServer(settings.provider, customDraft),
    };
    status = 'Custom server saved.';
  }

  async function toggleNoTransform(value: boolean): Promise<void> {
    settings = { ...settings, noTransform: value };
    await saveUploadNoTransform(value);
  }

  async function testDiscovery(): Promise<void> {
    if (!resolvedServer.trim())
      return void (status = 'Media upload is disabled.');
    if (customError) return void (status = customError);
    testing = true;
    status = '';
    try {
      const endpoint = await resolveUploadEndpoint(resolvedServer);
      status = `Discovery OK: ${endpoint}`;
    } catch (error) {
      status = error instanceof Error ? error.message : 'Discovery failed.';
    } finally {
      testing = false;
    }
  }
</script>

<section class="data-tab upload-settings-tab" aria-label="Upload Settings">
  <fieldset>
    <legend>Provider</legend>
    {#each mediaUploadProviders as provider (provider.id)}
      <label>
        <input
          type="radio"
          name="media-upload-provider"
          value={provider.id}
          checked={settings.provider === provider.id}
          onchange={() => void choose(provider.id)}
        />
        {provider.label}
      </label>
    {/each}
  </fieldset>
  <label>
    Custom server
    <input
      aria-invalid={customError ? 'true' : 'false'}
      aria-label="Custom upload server"
      value={customDraft}
      placeholder="https://media.example"
      oninput={(event) => (customDraft = event.currentTarget.value)}
      onblur={() => void saveCustom()}
    />
  </label>
  {#if customError}
    <p role="alert">{customError}</p>
  {/if}
  <label>
    <input
      type="checkbox"
      checked={settings.noTransform}
      onchange={(event) => void toggleNoTransform(event.currentTarget.checked)}
    />
    No transform
  </label>
  <dl>
    <dt>Resolved server</dt>
    <dd>{resolvedServer || 'disabled'}</dd>
  </dl>
  <button
    type="button"
    disabled={testing || Boolean(customError)}
    onclick={testDiscovery}
  >
    {testing ? 'Testing discovery...' : 'Test discovery'}
  </button>
  {#if status}
    <p role="status">{status}</p>
  {/if}
</section>
