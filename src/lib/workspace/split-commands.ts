import type { SplitDirection } from './layout-tree';
import type { Workspace } from './workspace';
import { splitFocusedPane } from './workspace';

export type SplitCommand = 'pane.splitRight' | 'pane.splitDown';

export function runSplitCommand(
  workspace: Workspace,
  paneId: string,
  command: SplitCommand,
): Workspace {
  const direction = splitCommandDirection(command);
  return splitFocusedPane({ ...workspace, focusedPaneId: paneId }, direction);
}

function splitCommandDirection(command: SplitCommand): SplitDirection {
  return command === 'pane.splitDown' ? 'vertical' : 'horizontal';
}
