<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import { uploadMediaFile } from '$lib/media/upload';
  import { loadUploadSettings, type UploadSettings } from '$lib/media/settings';
  import { settingsChangedEvent } from '$lib/settings/settings-events';
  import {
    loadProfileMetadata,
    publishProfileMetadata,
  } from '$lib/profile/profile-actions';
  import {
    draftFromMetadata,
    emptyProfileMetadataDraft,
    validateProfileMetadataDraft,
    type ProfileMetadataDraft,
  } from '$lib/profile/profile-metadata-draft';
  import type { RelaySet } from '$lib/relays/relay-store';
  import ProfileImageUpload from './ProfileImageUpload.svelte';
  import ProfileTextField from './ProfileTextField.svelte';

  type Props = {
    tabId: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let draft = $state<ProfileMetadataDraft>(emptyProfileMetadataDraft());
  let original = $state<ProfileMetadataDraft>(emptyProfileMetadataDraft());
  let loadedFor = $state('');
  let status = $state('');
  let loading = $state(false);
  let saving = $state(false);
  let uploading = $state<keyof ProfileMetadataDraft | ''>('');
  let uploadSettings = $state<UploadSettings>({
    provider: 'nostr-build',
    customServer: '',
    server: 'https://nostr.build',
    noTransform: true,
  });
  let error = $derived(validateProfileMetadataDraft(draft));
  let dirty = $derived(JSON.stringify(draft) !== JSON.stringify(original));
  let canEdit = $derived(Boolean(props.activeAccount?.capabilities.sign));
  let canSave = $derived(canEdit && dirty && !error && !loading && !saving);

  onMount(() => {
    void refreshUploadSettings();
    const reload = () => void refreshUploadSettings();
    window.addEventListener(settingsChangedEvent, reload);
    return () => window.removeEventListener(settingsChangedEvent, reload);
  });

  $effect(() => {
    const pubkey = props.activeAccount?.pubkey ?? '';
    if (!pubkey || pubkey === loadedFor) return;
    loadedFor = pubkey;
    loading = true;
    status = '';
    void loadProfileMetadata(pubkey)
      .then((metadata) => {
        const loaded = draftFromMetadata(metadata);
        draft = loaded;
        original = loaded;
      })
      .catch((caught) => {
        status =
          caught instanceof Error ? caught.message : 'Profile load failed.';
      })
      .finally(() => (loading = false));
  });

  async function refreshUploadSettings(): Promise<void> {
    uploadSettings = await loadUploadSettings();
  }

  async function save(): Promise<void> {
    if (!canSave || !props.activeAccount) return;
    saving = true;
    status = '';
    const result = await publishProfileMetadata(
      draft,
      props.relaySets,
      props.activeAccount.pubkey,
    );
    saving = false;
    status = result.ok ? 'Profile updated.' : result.message;
    if (result.ok) original = draft;
  }

  async function upload(
    key: Extract<keyof ProfileMetadataDraft, 'picture' | 'banner'>,
    files: FileList | null,
  ): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    if (!uploadSettings.server.trim())
      return void (status = 'Configure a media upload server first.');
    uploading = key;
    status = '';
    try {
      const uploaded = await uploadMediaFile(file, uploadSettings);
      update(key, uploaded.url);
      status = `${key} uploaded.`;
    } catch (caught) {
      status =
        caught instanceof Error ? caught.message : 'Media upload failed.';
    } finally {
      uploading = '';
    }
  }

  function update(key: keyof ProfileMetadataDraft, value: string): void {
    draft = { ...draft, [key]: value };
  }

  function reset(): void {
    draft = original;
    status = 'Profile draft reset.';
  }
</script>

<section class="data-tab profile-edit-tab" aria-label="Profile Edit">
  {#if canEdit}
    {#if loading}<p>Loading profile metadata...</p>{/if}
    <ProfileTextField
      label="Banner"
      value={draft.banner}
      update={(value) => update('banner', value)}
    />
    <ProfileImageUpload
      id={`profile-banner-${props.tabId}`}
      label="Upload banner"
      uploading={uploading === 'banner'}
      upload={(files) => void upload('banner', files)}
    />
    <ProfileTextField
      label="Picture"
      value={draft.picture}
      update={(value) => update('picture', value)}
    />
    <ProfileImageUpload
      id={`profile-picture-${props.tabId}`}
      label="Upload picture"
      uploading={uploading === 'picture'}
      upload={(files) => void upload('picture', files)}
    />
    <ProfileTextField
      label="Display name"
      value={draft.display_name}
      update={(value) => update('display_name', value)}
    />
    <ProfileTextField
      label="Name"
      value={draft.name}
      update={(value) => update('name', value)}
    />
    <ProfileTextField
      label="NIP-05"
      value={draft.nip05}
      update={(value) => update('nip05', value)}
    />
    <ProfileTextField
      label="Website"
      value={draft.website}
      update={(value) => update('website', value)}
    />
    <ProfileTextField
      label="Lightning address"
      value={draft.lud16}
      update={(value) => update('lud16', value)}
    />
    <ProfileTextField
      label="About"
      value={draft.about}
      multiline
      update={(value) => update('about', value)}
    />
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="toolbar">
      <button type="button" disabled={!dirty || saving} onclick={reset}
        >Reset</button
      >
      <button type="button" disabled={!canSave} onclick={save}
        >Save profile</button
      >
    </div>
  {:else}
    <p>Select a signing account before editing a profile.</p>
  {/if}
  {#if status}<p role="status">{status}</p>{/if}
</section>
