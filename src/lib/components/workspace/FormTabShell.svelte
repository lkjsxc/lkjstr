<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    class?: string;
    scrollOwner?: HTMLElement | undefined;
    children: Snippet;
  };

  let {
    label,
    class: className = '',
    scrollOwner = $bindable(),
    children,
  }: Props = $props();
</script>

<section class="form-tab {className}" aria-label={label}>
  <div class="form-tab__scroller">
    <div class="form-tab__scroll" data-scroll-owner="" bind:this={scrollOwner}>
      {@render children()}
    </div>
  </div>
</section>
