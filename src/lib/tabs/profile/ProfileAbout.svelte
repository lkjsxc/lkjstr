<script lang="ts">
  import EmojifiedText from '$lib/components/events/EmojifiedText.svelte';
  import type { CustomEmoji } from '$lib/protocol';

  type Props = {
    text: string;
    emojis?: readonly CustomEmoji[];
  };

  let props: Props = $props();
</script>

<p><EmojifiedText text={props.text} emojis={props.emojis ?? []} /></p>
