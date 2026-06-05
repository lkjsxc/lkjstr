<script lang="ts">
  import type { ContentAttachment } from '$lib/events/content-media';

  type Props = {
    attachment: ContentAttachment;
  };

  let props: Props = $props();

  function stop(event: Event): void {
    event.stopPropagation();
  }

  function open(): void {
    window.open(props.attachment.url, '_blank', 'noopener,noreferrer');
  }
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
{#if props.attachment.type === 'image'}
  <a
    class="media-embed media-embed--image-link"
    href={props.attachment.url}
    target="_blank"
    rel="noopener noreferrer"
    onclick={stop}
  >
    <span
      class="media-embed__image-box"
      style:aspect-ratio={props.attachment.aspectRatio}
    >
      <img
        class="media-embed__image"
        src={props.attachment.url}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  </a>
{:else if props.attachment.type === 'video'}
  <div
    class="media-embed media-embed--video"
    style:aspect-ratio={props.attachment.aspectRatio}
  >
    <!-- svelte-ignore a11y_media_has_caption -->
    <video src={props.attachment.url} controls onclick={stop}></video>
    <button type="button" onclick={(event) => (stop(event), open())}>
      Open video
    </button>
  </div>
{:else if props.attachment.type === 'audio'}
  <div class="media-embed media-embed--audio">
    <audio src={props.attachment.url} controls onclick={stop}></audio>
    <button type="button" onclick={(event) => (stop(event), open())}>
      Open audio
    </button>
  </div>
{:else}
  <a
    class="event-link"
    href={props.attachment.url}
    target="_blank"
    rel="noopener noreferrer"
    onclick={stop}
  >
    {props.attachment.url}
  </a>
{/if}
