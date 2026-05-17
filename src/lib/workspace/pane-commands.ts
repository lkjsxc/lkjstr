import { closePaneAndRecover } from './workspace';
import type { Workspace } from './workspace';

export function closeWorkspacePane(
  workspace: Workspace,
  paneId: string,
): Workspace {
  return closePaneAndRecover(workspace, paneId);
}
