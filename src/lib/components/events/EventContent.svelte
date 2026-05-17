<script lang="ts">
  type Props = {
    content: string;
  };

  let props: Props = $props();
</script>

<p class="event-content">{props.content}</p>
