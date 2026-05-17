<script lang="ts">
  type Props = {
    query: string;
    namespace: string;
    namespaces: string[];
    updateQuery: (query: string) => void;
    updateNamespace: (namespace: string) => void;
  };

  let props: Props = $props();
</script>

<div class="settings-search">
  <input
    aria-label="Search settings"
    value={props.query}
    placeholder="Search settings"
    oninput={(event) => props.updateQuery(event.currentTarget.value)}
  />
  <select
    aria-label="Settings namespace"
    value={props.namespace}
    onchange={(event) => props.updateNamespace(event.currentTarget.value)}
  >
    {#each props.namespaces as namespace (namespace)}
      <option value={namespace}>{namespace}</option>
    {/each}
  </select>
</div>
