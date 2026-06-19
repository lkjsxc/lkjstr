import type { EventTreeListViewRow } from './event-tree-list-helpers';
import { hasOpenThreadAction } from './action-availability';

export type EventTreeListContinuationPlan =
  | { readonly visible: false }
  | {
      readonly visible: true;
      readonly canOpenThread: boolean;
      readonly depth: number;
      readonly hiddenCount: number;
      readonly targetId: string;
      readonly buttonText: string;
      readonly unavailableText: string;
    };

export function continuationPlanForViewRow(
  row: EventTreeListViewRow,
  openThread?: (eventId: string) => void,
): EventTreeListContinuationPlan {
  if (row.kind !== 'event' || !('collapsed' in row.node))
    return { visible: false };
  const hiddenCount = row.node.hiddenCount;
  return {
    visible: true,
    canOpenThread: hasOpenThreadAction(openThread),
    depth: row.node.depth,
    hiddenCount,
    targetId: row.node.targetId,
    buttonText: `Continue thread (${hiddenCount})`,
    unavailableText: `${hiddenCount} hidden thread item(s) unavailable.`,
  };
}

export function openContinuationThread(
  continuation: EventTreeListContinuationPlan,
  openThread?: (eventId: string) => void,
): boolean {
  if (
    !continuation.visible ||
    !continuation.canOpenThread ||
    !hasOpenThreadAction(openThread)
  )
    return false;
  openThread(continuation.targetId);
  return true;
}
