export type TabFeedAnchor = {
  readonly eventId: string;
  readonly offset: number;
};

const anchors = new Map<string, TabFeedAnchor>();

export function setTabFeedAnchor(
  tabId: string,
  anchor: TabFeedAnchor | undefined,
): void {
  if (!anchor) {
    anchors.delete(tabId);
    return;
  }
  anchors.set(tabId, anchor);
}

export function takeTabFeedAnchor(tabId: string): TabFeedAnchor | undefined {
  return anchors.get(tabId);
}

export function clearTabFeedAnchor(tabId: string): void {
  anchors.delete(tabId);
}
