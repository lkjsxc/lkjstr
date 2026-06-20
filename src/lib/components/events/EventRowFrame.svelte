<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    children: Snippet;
    depthStyle: string;
    embedded?: boolean;
    fragment?: boolean;
    highlighted: boolean;
    interactive: boolean;
    onRowClick: (event: MouseEvent) => void;
    onRowKeydown: (event: KeyboardEvent) => void;
    compact?: boolean;
  };

  let props: Props = $props();
</script>

{#if props.interactive}
  <div
    class="event-row event-row--interactive"
    class:event-row--fragment={props.fragment}
    class:event-row--compact={props.compact}
    class:event-row--embedded={props.embedded}
    class:event-row--action-success={props.highlighted}
    role="button"
    tabindex="0"
    style={props.depthStyle}
    onclick={props.onRowClick}
    onkeydown={props.onRowKeydown}
  >
    {@render props.children()}
  </div>
{:else}
  <div
    class="event-row"
    class:event-row--fragment={props.fragment}
    class:event-row--compact={props.compact}
    class:event-row--embedded={props.embedded}
    class:event-row--action-success={props.highlighted}
    style={props.depthStyle}
  >
    {@render props.children()}
  </div>
{/if}
