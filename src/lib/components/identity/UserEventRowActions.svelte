<script lang="ts">
  type Props = {
    pubkey: string;
    copied?: boolean;
    openProfile?: (pubkey: string) => void;
    openUserTimeline?: (pubkey: string) => void;
    copyNpub?: (pubkey: string) => void | Promise<void>;
  };

  let props: Props = $props();

  function stop(event: MouseEvent): void {
    event.stopPropagation();
  }
</script>

<div class="user-event-row__actions event-action-zone">
  <button
    type="button"
    onclick={(event) => {
      stop(event);
      props.openProfile?.(props.pubkey);
    }}
  >
    Profile
  </button>
  {#if props.openUserTimeline}
    <button
      type="button"
      onclick={(event) => {
        stop(event);
        props.openUserTimeline?.(props.pubkey);
      }}
    >
      Timeline
    </button>
  {/if}
  {#if props.copyNpub}
    <button
      type="button"
      onclick={(event) => {
        stop(event);
        void props.copyNpub?.(props.pubkey);
      }}
    >
      Copy npub
    </button>
  {/if}
  {#if props.copied}<span role="status">Copied</span>{/if}
</div>
