<script lang="ts">
  import type { ContentAttachment } from '$lib/events/content-media';
  import {
    mediaAttachmentOpenAfterStop,
    mediaAttachmentOpenButtonLabel,
    openMediaAttachment,
    planMediaAttachmentLink,
    stopMediaAttachmentPropagation,
  } from './media-attachment-plan';

  type Props = {
    attachment: ContentAttachment;
  };

  let props: Props = $props();

  function open(): void {
    openMediaAttachment(props.attachment, (url, target, features) =>
      window.open(url, target, features),
    );
  }
</script>

{#snippet openButton()}
  <button
    type="button"
    onclick={(event) => mediaAttachmentOpenAfterStop(event, open)}
  >
    {mediaAttachmentOpenButtonLabel(props.attachment.type)}
  </button>
{/snippet}

<!-- eslint-disable svelte/no-navigation-without-resolve -->
{#if props.attachment.type === 'image'}
  {@const link = planMediaAttachmentLink(props.attachment)}
  <a
    class="media-embed media-embed--image-link"
    href={link.href}
    target={link.target}
    rel={link.rel}
    onclick={stopMediaAttachmentPropagation}
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
    <video
      src={props.attachment.url}
      controls
      onclick={stopMediaAttachmentPropagation}
    ></video>
    {@render openButton()}
  </div>
{:else if props.attachment.type === 'audio'}
  <div class="media-embed media-embed--audio">
    <audio
      src={props.attachment.url}
      controls
      onclick={stopMediaAttachmentPropagation}
    ></audio>
    {@render openButton()}
  </div>
{:else}
  {@const link = planMediaAttachmentLink(props.attachment)}
  <a
    class="event-link"
    href={link.href}
    target={link.target}
    rel={link.rel}
    onclick={stopMediaAttachmentPropagation}
  >
    {props.attachment.url}
  </a>
{/if}
