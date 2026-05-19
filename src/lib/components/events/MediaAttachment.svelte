<script lang="ts">
  import type { ContentAttachment } from '$lib/events/content-media';

  type Props = {
    attachment: ContentAttachment;
  };

  let props: Props = $props();

  function stop(event: Event): void {
    event.stopPropagation();
  }
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
{#if props.attachment.type === 'image'}
  <a class="media-embed" href={props.attachment.url} onclick={stop}>
    <img src={props.attachment.url} alt="" loading="lazy" />
  </a>
{:else if props.attachment.type === 'video'}
  <!-- svelte-ignore a11y_media_has_caption -->
  <video class="media-embed" src={props.attachment.url} controls onclick={stop}>
    <a href={props.attachment.url}>Open video</a>
  </video>
{:else if props.attachment.type === 'audio'}
  <audio class="media-embed" src={props.attachment.url} controls onclick={stop}>
    <a href={props.attachment.url}>Open audio</a>
  </audio>
{:else}
  <a class="event-link" href={props.attachment.url} onclick={stop}>
    {props.attachment.url}
  </a>
{/if}
