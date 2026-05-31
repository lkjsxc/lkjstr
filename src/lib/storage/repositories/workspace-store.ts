import type { Workspace } from '../../workspace/workspace';
import { browserDb } from '../browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../safe-storage';

export async function readWorkspaceRow(
  id: string,
): Promise<Workspace | undefined> {
  return boundedStorageRead(() => browserDb().workspaces.get(id), undefined);
}

export async function putWorkspaceRow(workspace: Workspace): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().workspaces.put(workspace));
}
