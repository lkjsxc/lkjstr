import {
  addNip07Account,
  addReadonlyAccount,
} from '$lib/accounts/account-manager';
import { activeAccount, listAccounts } from '$lib/accounts/account-store';
import type { Account } from '$lib/accounts/account';
import { accountNotifications } from '$lib/notifications/notification-store';
import type { NotificationRecord } from '$lib/notifications/notification';
import {
  createDraftNode,
  getOrCreatePostTree,
  treeNodes,
} from '$lib/post-manager/post-store';
import type { PostTreeNode } from '$lib/post-manager/post-tree';
import { listRelaySets, type RelaySet } from '$lib/relays/relay-store';

export type WorkspacePageData = {
  readonly accounts: Account[];
  readonly notifications: NotificationRecord[];
  readonly postNodes: PostTreeNode[];
  readonly relaySets: RelaySet[];
};

export async function loadWorkspacePageData(): Promise<WorkspacePageData> {
  const accounts = await listAccounts();
  const relaySets = await listRelaySets();
  const active = await activeAccount();
  const notifications = active ? await accountNotifications(active.pubkey) : [];
  const postNodes = active ? await activePostNodes(active.pubkey) : [];
  return { accounts, notifications, postNodes, relaySets };
}

export async function addReadonlyFromInput(input: string): Promise<string> {
  await addReadonlyAccount(input);
  return 'Read-only account added.';
}

export async function addNip07FromProvider(): Promise<string> {
  await addNip07Account();
  return 'NIP-07 account added.';
}

export async function createDraftForActiveAccount(): Promise<string> {
  const active = await activeAccount();
  if (!active) return 'Add an account before creating drafts.';
  const tree = await getOrCreatePostTree(active.pubkey);
  await createDraftNode(tree, 'Untitled draft');
  return 'Draft node created.';
}

async function activePostNodes(pubkey: string): Promise<PostTreeNode[]> {
  const tree = await getOrCreatePostTree(pubkey);
  return treeNodes(tree.id);
}
