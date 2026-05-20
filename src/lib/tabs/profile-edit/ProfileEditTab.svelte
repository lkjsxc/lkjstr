<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import {
    loadProfileMetadata,
    publishProfileMetadata,
  } from '$lib/profile/profile-actions';
  import {
    draftFromMetadata,
    validateProfileMetadataDraft,
    type ProfileMetadataDraft,
  } from '$lib/profile/profile-metadata-draft';
  import type { RelaySet } from '$lib/relays/relay-store';

  type Props = {
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let draft = $state<ProfileMetadataDraft>(emptyDraft());
  let loadedFor = $state('');
  let status = $state('');
  let busy = $state(false);

  $effect(() => {
    const pubkey = props.activeAccount?.pubkey ?? '';
    if (!pubkey || pubkey === loadedFor) return;
    loadedFor = pubkey;
    void loadProfileMetadata(pubkey).then((metadata) => {
      draft = draftFromMetadata(metadata);
    });
  });

  async function save(): Promise<void> {
    const error = validateProfileMetadataDraft(draft);
    if (error) return void (status = error);
    busy = true;
    status = '';
    const result = await publishProfileMetadata(draft, props.relaySets);
    busy = false;
    status = result.ok ? 'Profile updated.' : result.message;
  }

  function update(key: keyof ProfileMetadataDraft, value: string): void {
    draft = { ...draft, [key]: value };
  }

  function emptyDraft(): ProfileMetadataDraft {
    return {
      banner: '',
      picture: '',
      display_name: '',
      name: '',
      nip05: '',
      website: '',
      lud16: '',
      about: '',
    };
  }
</script>

<section class="data-tab profile-edit-tab">
  <h2>Profile Edit</h2>
  {#if props.activeAccount?.capabilities.sign && props.activeAccount.enabled}
    <label
      >Banner <input
        value={draft.banner}
        oninput={(e) => update('banner', e.currentTarget.value)}
      /></label
    >
    <label
      >Picture <input
        value={draft.picture}
        oninput={(e) => update('picture', e.currentTarget.value)}
      /></label
    >
    <label
      >Display name <input
        value={draft.display_name}
        oninput={(e) => update('display_name', e.currentTarget.value)}
      /></label
    >
    <label
      >Name <input
        value={draft.name}
        oninput={(e) => update('name', e.currentTarget.value)}
      /></label
    >
    <label
      >NIP-05 <input
        value={draft.nip05}
        oninput={(e) => update('nip05', e.currentTarget.value)}
      /></label
    >
    <label
      >Website <input
        value={draft.website}
        oninput={(e) => update('website', e.currentTarget.value)}
      /></label
    >
    <label
      >Lightning address <input
        value={draft.lud16}
        oninput={(e) => update('lud16', e.currentTarget.value)}
      /></label
    >
    <label
      >About <textarea
        rows="5"
        value={draft.about}
        oninput={(e) => update('about', e.currentTarget.value)}
      ></textarea></label
    >
    <button type="button" disabled={busy} onclick={save}>Save profile</button>
  {:else}
    <p>Select an enabled signing account before editing a profile.</p>
  {/if}
  {#if status}<p role="status">{status}</p>{/if}
</section>
