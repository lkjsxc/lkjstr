<script lang="ts">
  import type { ProfileSummary } from '$lib/identity/identity';
  import EmojifiedText from './EmojifiedText.svelte';

  type Props = {
    pubkey: string;
    text: string;
    rawText: string;
    profile?: ProfileSummary;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();
</script>

<button
  type="button"
  class="content-token"
  title={props.rawText}
  onclick={(event) => {
    event.stopPropagation();
    props.openProfile?.(props.pubkey);
  }}
>
  <EmojifiedText text={props.text} emojis={props.profile?.customEmojis ?? []} />
</button>
