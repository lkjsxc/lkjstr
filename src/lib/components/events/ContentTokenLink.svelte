<script lang="ts">
  import {
    contentTokenUrlLinkPlan,
    stopContentTokenLinkPropagation,
  } from './content-token-plan';

  type Props = {
    text: string;
    url: string;
  };

  let props: Props = $props();
  let link = $derived(contentTokenUrlLinkPlan(props.url));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
  class="event-link"
  href={link.href}
  target={link.target}
  rel={link.rel}
  onclick={stopContentTokenLinkPropagation}>{props.text}</a
>
