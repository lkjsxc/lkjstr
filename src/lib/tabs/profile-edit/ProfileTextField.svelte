<script lang="ts">
  type Props = {
    label: string;
    value: string;
    multiline?: boolean;
    update: (value: string) => void;
  };

  let props: Props = $props();
</script>

<label>
  {props.label}
  {#if props.multiline}
    <textarea
      rows="5"
      value={props.value}
      oninput={(event) => props.update(event.currentTarget.value)}
    ></textarea>
  {:else}
    <input
      value={props.value}
      oninput={(event) => props.update(event.currentTarget.value)}
    />
  {/if}
</label>
