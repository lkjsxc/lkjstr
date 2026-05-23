<script lang="ts">
  type Props = {
    loading: boolean;
    load: () => void;
  };

  let props: Props = $props();
</script>

<button
  type="button"
  class="event-list__status"
  disabled={props.loading}
  onclick={props.load}
>
  {props.loading ? 'Loading newer notes...' : 'Load newer notes'}
</button>
