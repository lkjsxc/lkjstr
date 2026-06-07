<script lang="ts">
  import FormTabShell from '$lib/components/workspace/FormTabShell.svelte';
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import { settingsChangedEvent } from '$lib/settings/settings-events';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { createProfileEditController } from './profile-edit-controller';
  import ProfileImageUpload from './ProfileImageUpload.svelte';
  import ProfileTextField from './ProfileTextField.svelte';

  type Props = {
    tabId: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    openUploadSettings: () => void;
  };

  let props: Props = $props();
  let destroyed = false;
  const controller = createProfileEditController({
    getAccount: () => props.activeAccount,
    getRelaySets: () => props.relaySets,
    isDestroyed: () => destroyed,
  });
  let view = $state(controller.snapshot());

  onMount(() => {
    void controller.refreshUploadSettings().then(() => {
      if (!destroyed) view = controller.snapshot();
    });
    const reload = () =>
      void controller.refreshUploadSettings().then(() => {
        if (!destroyed) view = controller.snapshot();
      });
    window.addEventListener(settingsChangedEvent, reload);
    return () => {
      destroyed = true;
      window.removeEventListener(settingsChangedEvent, reload);
    };
  });

  $effect(() => {
    controller.loadForPubkey(props.activeAccount?.pubkey ?? '');
    view = controller.snapshot();
  });

  const refresh = (): void => {
    view = controller.snapshot();
  };
</script>

<FormTabShell label="Profile Edit" class="data-tab profile-edit-tab">
  {#if view.canEdit}
    {#if view.loading}<p>Loading profile metadata...</p>{/if}
    <ProfileTextField
      label="Banner"
      value={view.draft.banner}
      update={(value) => {
        controller.update('banner', value);
        refresh();
      }}
    />
    <ProfileImageUpload
      id={`profile-banner-${props.tabId}`}
      label="Upload banner"
      uploading={view.uploading === 'banner'}
      uploadConfigured={Boolean(view.uploadSettings.server.trim())}
      openUploadSettings={props.openUploadSettings}
      upload={(files) => void controller.upload('banner', files).then(refresh)}
    />
    <ProfileTextField
      label="Picture"
      value={view.draft.picture}
      update={(value) => {
        controller.update('picture', value);
        refresh();
      }}
    />
    <ProfileImageUpload
      id={`profile-picture-${props.tabId}`}
      label="Upload picture"
      uploading={view.uploading === 'picture'}
      uploadConfigured={Boolean(view.uploadSettings.server.trim())}
      openUploadSettings={props.openUploadSettings}
      upload={(files) => void controller.upload('picture', files).then(refresh)}
    />
    <ProfileTextField
      label="Display name"
      value={view.draft.display_name}
      update={(value) => {
        controller.update('display_name', value);
        refresh();
      }}
    />
    <ProfileTextField
      label="Name"
      value={view.draft.name}
      update={(value) => {
        controller.update('name', value);
        refresh();
      }}
    />
    <ProfileTextField
      label="NIP-05"
      value={view.draft.nip05}
      update={(value) => {
        controller.update('nip05', value);
        refresh();
      }}
    />
    <ProfileTextField
      label="Website"
      value={view.draft.website}
      update={(value) => {
        controller.update('website', value);
        refresh();
      }}
    />
    <ProfileTextField
      label="Lightning address"
      value={view.draft.lud16}
      update={(value) => {
        controller.update('lud16', value);
        refresh();
      }}
    />
    <ProfileTextField
      label="About"
      value={view.draft.about}
      multiline
      update={(value) => {
        controller.update('about', value);
        refresh();
      }}
    />
    {#if view.error}<p role="alert">{view.error}</p>{/if}
    <div class="toolbar">
      <button
        type="button"
        disabled={!view.dirty || view.saving}
        onclick={() => {
          controller.reset();
          refresh();
        }}>Reset</button
      >
      <button
        type="button"
        disabled={!view.canSave}
        onclick={() => void controller.save().then(refresh)}
        >Save profile</button
      >
    </div>
  {:else}
    <p>Select a signing account before editing a profile.</p>
  {/if}
  {#if view.status}<p role="status">{view.status}</p>{/if}
</FormTabShell>
