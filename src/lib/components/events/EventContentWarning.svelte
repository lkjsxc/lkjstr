<script lang="ts">
  import type { EventContentSensitivity } from './event-content-plan';

  type Props = {
    sensitivity: EventContentSensitivity;
    onReveal: (event: MouseEvent) => void;
  };

  let props: Props = $props();
</script>

<aside class="content-warning">
  <strong>{props.sensitivity.label}</strong>
  {#if props.sensitivity.reason}<span>{props.sensitivity.reason}</span>{/if}
  <button type="button" onclick={props.onReveal}>
    {props.sensitivity.revealLabel}
  </button>
</aside>
