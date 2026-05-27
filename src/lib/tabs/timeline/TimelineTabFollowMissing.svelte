<script lang="ts">
  import { homeNoFollowGuidance } from '$lib/timeline/timeline-state';

  type Props = {
    readonly retry: () => void;
  };

  const { retry }: Props = $props();
</script>

<div class="timeline-tab__guidance">
  <p>{homeNoFollowGuidance}</p>
  <button type="button" class="timeline-tab__retry" onclick={retry}>
    Check relays again
  </button>
</div>
