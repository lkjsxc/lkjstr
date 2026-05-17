import type { SplitDirection } from './layout-tree';
import { splitPaneInto } from './n-way-split';
import type { Workspace } from './workspace';

export type SplitCommand =
  | 'pane.splitRight'
  | 'pane.splitDown'
  | 'pane.splitInto3Columns'
  | 'pane.splitInto3Rows'
  | 'pane.splitInto5Columns'
  | 'pane.splitInto5Rows';

export function runSplitCommand(
  workspace: Workspace,
  paneId: string,
  command: SplitCommand,
): Workspace {
  const [direction, count] = splitCommandShape(command);
  return splitPaneInto(workspace, paneId, direction, count);
}

function splitCommandShape(command: SplitCommand): [SplitDirection, number] {
  if (command.endsWith('Rows') || command === 'pane.splitDown')
    return [
      'vertical',
      command.includes('5') ? 5 : command.includes('3') ? 3 : 2,
    ];
  return [
    'horizontal',
    command.includes('5') ? 5 : command.includes('3') ? 3 : 2,
  ];
}
