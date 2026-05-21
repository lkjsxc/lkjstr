<script lang="ts">
  type Props = {
    sensitive: boolean;
    warningReason: string;
    touchDraft: () => void;
    flushDraft: () => Promise<void>;
  };

  let {
    sensitive = $bindable(),
    warningReason = $bindable(),
    touchDraft,
    flushDraft,
  }: Props = $props();
</script>

<label class="tweet-sensitive">
  <input
    id="tweet-sensitive"
    name="tweet-sensitive"
    type="checkbox"
    checked={sensitive}
    onchange={(event) => {
      sensitive = event.currentTarget.checked;
      touchDraft();
    }}
  />
  Sensitive content
</label>
{#if sensitive}
  <input
    aria-label="Content warning reason"
    value={warningReason}
    id="tweet-content-warning"
    name="tweet-content-warning"
    placeholder="Optional warning reason"
    oninput={(event) => {
      warningReason = event.currentTarget.value;
      touchDraft();
    }}
    onblur={() => void flushDraft()}
  />
{/if}
