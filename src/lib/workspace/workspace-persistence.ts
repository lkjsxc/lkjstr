import { safeGetItem, safeSetItem } from '../storage/safe-storage';
import {
  putWorkspaceRow,
  readWorkspaceRow,
} from '../storage/repositories/workspace-store';
import type { Workspace } from './workspace';
import {
  bootstrapWorkspace,
  bootstrapWorkspaceId,
} from './workspace-bootstrap';
import { normalizeWorkspace } from './workspace-normalize';

const snapshotKey = 'lkjstr.workspaceSnapshot';
const maxWorkspaceSnapshotBytes = 200_000;
let memoryWorkspace: Workspace | undefined;

export async function loadWorkspace(): Promise<Workspace> {
  const snapshot = loadSnapshot() ?? memoryWorkspace;
  const saved = await readWorkspaceRow(bootstrapWorkspaceId);
  const loaded =
    saved && (!snapshot || saved.updatedAt >= snapshot.updatedAt)
      ? normalizeWorkspace(saved)
      : snapshot;
  const workspace = loaded ?? bootstrapWorkspace();
  memoryWorkspace = workspace;
  return workspace;
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const saved = JSON.parse(
    JSON.stringify({ ...workspace, updatedAt: Date.now() }),
  ) as Workspace;
  memoryWorkspace = saved;
  saveSnapshot(saved);
  await putWorkspaceRow(saved);
}

export async function resetWorkspace(): Promise<Workspace> {
  const workspace = { ...bootstrapWorkspace(), updatedAt: Date.now() };
  await saveWorkspace(workspace);
  return workspace;
}

function saveSnapshot(workspace: Workspace): void {
  safeSetItem(snapshotKey, JSON.stringify(workspace));
}

function loadSnapshot(): Workspace | undefined {
  const raw = safeGetItem(snapshotKey);
  if (!raw) return undefined;
  if (raw.length > maxWorkspaceSnapshotBytes) return undefined;
  try {
    return normalizeWorkspace(JSON.parse(raw));
  } catch {
    return undefined;
  }
}
