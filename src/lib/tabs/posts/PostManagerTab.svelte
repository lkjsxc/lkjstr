<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { PostTreeNode } from '$lib/post-manager/post-tree';
  import {
    archiveDraftNode,
    duplicateDraftNode,
    updateDraftNode,
  } from '$lib/post-manager/post-store';

  type Props = {
    accounts: Account[];
    postNodes: PostTreeNode[];
    createDraft: () => void;
    refresh: () => void;
  };

  let props: Props = $props();
  let active = $derived(props.accounts[0]);

  async function update(
    node: PostTreeNode,
    patch: Partial<Pick<PostTreeNode, 'title' | 'contentPreview'>>,
  ): Promise<void> {
    await updateDraftNode(node, patch);
    props.refresh();
  }

  async function archive(node: PostTreeNode): Promise<void> {
    await archiveDraftNode(node);
    props.refresh();
  }

  async function duplicate(node: PostTreeNode): Promise<void> {
    await duplicateDraftNode(node);
    props.refresh();
  }
</script>

<section class="data-tab">
  <h2>Posts</h2>
  {#if !active}
    <p>Add an account before creating local drafts.</p>
  {:else}
    <button type="button" onclick={props.createDraft}>New draft</button>
    {#each props.postNodes as node (node.id)}
      <article class="draft-node">
        <input
          aria-label={`Title ${node.id}`}
          value={node.title}
          onblur={(event) => update(node, { title: event.currentTarget.value })}
        />
        <textarea
          aria-label={`Content ${node.id}`}
          value={node.contentPreview}
          onblur={(event) =>
            update(node, { contentPreview: event.currentTarget.value })}
        ></textarea>
        <small>{node.status}</small>
        <button type="button" onclick={() => duplicate(node)}>Duplicate</button>
        <button type="button" onclick={() => archive(node)}>Archive</button>
      </article>
    {:else}
      <p>No draft nodes are stored for this account.</p>
    {/each}
  {/if}
</section>
