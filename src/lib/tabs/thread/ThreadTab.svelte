<script lang="ts">
  type Props = {
    eventId?: string;
  };

  let props: Props = $props();
</script>

<section class="data-tab">
  <h2>Thread</h2>
  {#if props.eventId}
    <p>Thread root: {props.eventId}</p>
  {:else}
    <p>Enter a thread event id from New Tab.</p>
  {/if}
</section>
