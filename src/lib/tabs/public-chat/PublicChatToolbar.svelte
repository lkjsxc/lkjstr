<script lang="ts">
  type Props = {
    status: string;
    readRelays: readonly string[];
    writeRelays: readonly string[];
    loading: boolean;
    openId: string;
    newChannelName: string;
    setOpenId: (value: string) => void;
    setNewChannelName: (value: string) => void;
    refreshChannels: () => void;
    openChannelById: () => void;
    createChannel: () => void;
    canCreate: boolean;
  };

  let props: Props = $props();
</script>

<header>
  <h2>Public Chat</h2>
  <p>{props.status}</p>
</header>
<p>
  Read relays: {props.readRelays.length
    ? props.readRelays.join(', ')
    : 'none selected'}
</p>
<p>
  Write relays: {props.writeRelays.length
    ? props.writeRelays.join(', ')
    : 'none enabled'}
</p>
<div class="public-chat-actions">
  <button type="button" onclick={props.refreshChannels} disabled={props.loading}
    >Refresh</button
  >
  <input
    value={props.openId}
    oninput={(event) => props.setOpenId(event.currentTarget.value)}
    placeholder="Channel event id"
    aria-label="Open channel id"
  />
  <button type="button" onclick={props.openChannelById}>Open</button>
</div>
<form
  onsubmit={(event) => {
    event.preventDefault();
    props.createChannel();
  }}
>
  <input
    value={props.newChannelName}
    oninput={(event) => props.setNewChannelName(event.currentTarget.value)}
    placeholder="New channel name"
    aria-label="New channel name"
  />
  <button type="submit" disabled={!props.canCreate}>Create channel</button>
</form>
