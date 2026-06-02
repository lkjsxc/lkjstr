import type { Workspace } from '../../workspace/workspace';
import {
  sqlitePutWorkspace,
  sqliteReadWorkspace,
} from '../sqlite-opfs/workspace-sqlite';

let memoryWorkspace: Workspace | undefined;
const startupReadDeadlineMs = 3_000;

export async function readWorkspaceRow(
  id: string,
): Promise<Workspace | undefined> {
  if (memoryWorkspace) {
    void refreshMemoryWorkspace(id);
    return memoryWorkspace;
  }
  const row = await Promise.race([
    sqliteReadWorkspace(id).catch(() => undefined),
    fallbackAfter(startupReadDeadlineMs, undefined),
  ]);
  memoryWorkspace = row ?? memoryWorkspace;
  return memoryWorkspace;
}

export async function putWorkspaceRow(workspace: Workspace): Promise<void> {
  memoryWorkspace = workspace;
  await sqlitePutWorkspace(workspace).catch(() => false);
}

async function refreshMemoryWorkspace(id: string): Promise<void> {
  memoryWorkspace =
    (await sqliteReadWorkspace(id).catch(() => undefined)) ?? memoryWorkspace;
}

function fallbackAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
