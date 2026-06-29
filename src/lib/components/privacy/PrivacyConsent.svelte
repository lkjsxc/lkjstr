<script lang="ts">
  import { onMount } from 'svelte';
  import {
    acceptAllPrivacy,
    customizePrivacy,
    disabledPrivacyChoices,
    rejectAllPrivacy,
    withdrawPrivacy,
    type PrivacyChoices,
    type PrivacyConsentRecord,
  } from '$lib/privacy/consent';
  import {
    clearOptionalPrivacyData,
    loadPrivacyConsent,
    savePrivacyConsent,
  } from '$lib/privacy/storage';

  let ready = $state(false);
  let customizing = $state(false);
  let record = $state<PrivacyConsentRecord>();
  let choices = $state<PrivacyChoices>({ ...disabledPrivacyChoices });
  let status = $state('');

  onMount(() => {
    record = loadPrivacyConsent();
    choices = { ...(record?.choices ?? disabledPrivacyChoices) };
    ready = true;
  });

  const openSettings = (): void => {
    choices = { ...(record?.choices ?? disabledPrivacyChoices) };
    customizing = true;
    status = '';
  };

  const rejectAll = (): void => {
    clearOptionalPrivacyData();
    persist(rejectAllPrivacy(), 'Optional processing rejected.');
  };

  const acceptAll = (): void => {
    persist(acceptAllPrivacy(), 'Optional processing accepted.');
  };

  const saveCustom = (): void => {
    persist(customizePrivacy(choices), 'Privacy choices saved.');
  };

  const withdraw = (): void => {
    clearOptionalPrivacyData();
    persist(
      withdrawPrivacy(),
      'Optional consent withdrawn and optional data cleared.',
    );
  };

  function persist(next: PrivacyConsentRecord, message: string): void {
    if (!savePrivacyConsent(next)) {
      status =
        'Privacy choices could not be saved; optional processing remains disabled.';
      record = rejectAllPrivacy();
      choices = { ...record.choices };
      return;
    }
    record = next;
    choices = { ...next.choices };
    customizing = false;
    status = message;
  }
</script>

{#if ready}
  <section class="privacy-consent" aria-label="Privacy consent">
    {#if !record && !customizing}
      <div class="privacy-consent__panel" data-testid="privacy-banner">
        <strong>Privacy choices</strong>
        <p>
          Essential local-first storage keeps the workspace, accounts, relays,
          drafts, cache, diagnostics, and this consent choice working. Optional
          cookies, telemetry, and non-essential storage stay off until you opt
          in.
        </p>
        <div class="privacy-consent__actions">
          <button type="button" onclick={rejectAll}>Reject All</button>
          <button type="button" onclick={acceptAll}>Accept All</button>
          <button type="button" onclick={openSettings}>Customize</button>
        </div>
      </div>
    {:else if customizing}
      <form
        class="privacy-consent__panel"
        onsubmit={(event) => event.preventDefault()}
      >
        <strong>Privacy settings</strong>
        <label>
          <input type="checkbox" bind:checked={choices.cookies} />
          Optional cookies
        </label>
        <label>
          <input type="checkbox" bind:checked={choices.telemetry} />
          Optional telemetry
        </label>
        <label>
          <input type="checkbox" bind:checked={choices.nonEssentialStorage} />
          Optional non-essential local storage
        </label>
        <div class="privacy-consent__actions">
          <button type="button" onclick={rejectAll}>Reject All</button>
          <button type="button" onclick={acceptAll}>Accept All</button>
          <button type="button" onclick={saveCustom}>Save Choices</button>
          <button type="button" onclick={() => (customizing = false)}
            >Close</button
          >
          {#if record}<button type="button" onclick={withdraw}>Withdraw</button
            >{/if}
        </div>
      </form>
    {:else}
      <button
        class="privacy-consent__settings"
        type="button"
        onclick={openSettings}
      >
        Privacy settings
      </button>
    {/if}
    {#if status}<p class="privacy-consent__status" role="status">
        {status}
      </p>{/if}
  </section>
{/if}

<style>
  .privacy-consent {
    bottom: var(--space-3, 0.75rem);
    left: var(--space-3, 0.75rem);
    max-width: min(42rem, calc(100vw - 1.5rem));
    position: fixed;
    z-index: 20;
  }
  .privacy-consent__panel,
  .privacy-consent__settings,
  .privacy-consent__status {
    background: var(--color-panel, #111);
    border: 1px solid var(--color-border, #444);
    border-radius: 0.75rem;
    color: inherit;
    padding: 0.75rem;
  }
  .privacy-consent__panel label,
  .privacy-consent__status {
    display: block;
    margin-top: 0.5rem;
  }
  .privacy-consent__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
</style>
