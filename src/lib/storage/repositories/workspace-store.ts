import type { Workspace } from '../../workspace/workspace';
import {
  sqlitePutWorkspace,
  sqliteReadWorkspace,
} from '../sqlite-opfs/workspace-sqlite';

let memoryWorkspace: Workspace | undefined;

export async function readWorkspaceRow(
  id: string,
): Promise<Workspace | undefined> {
  const row = await sqliteReadWorkspace(id).catch(() => undefined);
  memoryWorkspace = row ?? memoryWorkspace;
  return row ?? memoryWorkspace;
}

export async function putWorkspaceRow(workspace: Workspace): Promise<void> {
  memoryWorkspace = workspace;
  await sqlitePutWorkspace(workspace).catch(() => false);
}
