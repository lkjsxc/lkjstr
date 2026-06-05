import type { Account } from '$lib/accounts/account';
import { uploadMediaFile } from '$lib/media/upload';
import { loadUploadSettings, type UploadSettings } from '$lib/media/settings';
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

export function createProfileEditController(input: {
  readonly getAccount: () => Account | undefined;
  readonly getRelaySets: () => readonly RelaySet[];
  readonly isDestroyed: () => boolean;
}) {
  let draft = emptyProfileMetadataDraft();
  let original = emptyProfileMetadataDraft();
  let loadedFor = '';
  let status = '';
  let loading = false;
  let saving = false;
  let uploading: keyof ProfileMetadataDraft | '' = '';
  let uploadSettings: UploadSettings = {
    provider: 'blossom',
    customServer: '',
    server: '',
    protocol: 'blossom',
    noTransform: true,
  };

  const snapshot = () => ({
    draft,
    original,
    status,
    loading,
    saving,
    uploading,
    uploadSettings,
    error: validateProfileMetadataDraft(draft),
    dirty: JSON.stringify(draft) !== JSON.stringify(original),
    canEdit: Boolean(input.getAccount()?.capabilities.sign),
    canSave:
      Boolean(input.getAccount()?.capabilities.sign) &&
      JSON.stringify(draft) !== JSON.stringify(original) &&
      !validateProfileMetadataDraft(draft) &&
      !loading &&
      !saving,
  });

  async function refreshUploadSettings(): Promise<void> {
    uploadSettings = await loadUploadSettings();
  }

  function loadForPubkey(pubkey: string): void {
    if (!pubkey || pubkey === loadedFor) return;
    loadedFor = pubkey;
    loading = true;
    status = '';
    void loadProfileMetadata(pubkey)
      .then((metadata) => {
        if (input.isDestroyed()) return;
        const loaded = draftFromMetadata(metadata);
        draft = loaded;
        original = loaded;
      })
      .catch((caught) => {
        if (input.isDestroyed()) return;
        status =
          caught instanceof Error ? caught.message : 'Profile load failed.';
      })
      .finally(() => {
        if (!input.isDestroyed()) loading = false;
      });
  }

  async function save(): Promise<void> {
    const account = input.getAccount();
    const state = snapshot();
    if (!state.canSave || !account) return;
    saving = true;
    status = '';
    const result = await publishProfileMetadata(
      draft,
      input.getRelaySets(),
      account.pubkey,
    );
    if (input.isDestroyed()) return;
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
    if (!uploadSettings.server.trim()) {
      status = 'Configure a media upload server first.';
      return;
    }
    uploading = key;
    status = '';
    try {
      const uploaded = await uploadMediaFile(file, uploadSettings);
      if (input.isDestroyed()) return;
      draft = { ...draft, [key]: uploaded.url };
      status = `${key} uploaded.`;
    } catch (caught) {
      if (input.isDestroyed()) return;
      status =
        caught instanceof Error ? caught.message : 'Media upload failed.';
    } finally {
      if (!input.isDestroyed()) uploading = '';
    }
  }

  function update(key: keyof ProfileMetadataDraft, value: string): void {
    draft = { ...draft, [key]: value };
  }

  function reset(): void {
    draft = original;
    status = 'Profile draft reset.';
  }

  return {
    snapshot,
    refreshUploadSettings,
    loadForPubkey,
    save,
    upload,
    update,
    reset,
  };
}
