<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    active?: boolean;
    ariaPressed: boolean;
    children: Snippet;
    disabled: boolean;
    label: string;
    onclick: () => void;
    pressed?: boolean;
    title: string;
  };

  let props: Props = $props();
</script>

<button
  type="button"
  class="icon-button"
  class:active={props.active}
  class:icon-button--pressed={props.pressed}
  title={props.title}
  disabled={props.disabled}
  aria-pressed={props.ariaPressed}
  onclick={props.onclick}
>
  {@render props.children()}
  <span class="sr-only">{props.label}</span>
</button>
