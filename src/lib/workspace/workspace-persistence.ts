import { browserDb } from '../storage/browser-db';
import { createWorkspace, type Workspace } from './workspace';

const currentWorkspaceId = 'main';
const snapshotKey = 'lkjstr.workspaceSnapshot';

export async function loadWorkspace(): Promise<Workspace> {
  const saved = await browserDb().workspaces.get(currentWorkspaceId);
  const snapshot = loadSnapshot();
  if (saved && (!snapshot || saved.updatedAt >= snapshot.updatedAt))
    return saved;
  if (snapshot) return snapshot;
  const workspace = { ...createWorkspace(), id: currentWorkspaceId };
  await saveWorkspace(workspace);
  return workspace;
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const saved = JSON.parse(
    JSON.stringify({ ...workspace, updatedAt: Date.now() }),
  ) as Workspace;
  saveSnapshot(saved);
  await browserDb().workspaces.put(saved);
}

export async function resetWorkspace(): Promise<Workspace> {
  const workspace = { ...createWorkspace(), id: currentWorkspaceId };
  await saveWorkspace(workspace);
  return workspace;
}

function saveSnapshot(workspace: Workspace): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(snapshotKey, JSON.stringify(workspace));
}

function loadSnapshot(): Workspace | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(snapshotKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Workspace;
  } catch {
    return undefined;
  }
}
