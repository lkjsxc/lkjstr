import { unreadCount } from '$lib/notifications/notification-index';
import type { NotificationRecord } from '$lib/notifications/notification';
import { loadSettings } from '$lib/settings/settings-store';
import type { Workspace } from './workspace';

export async function withNotificationUnreadCounts(
  workspace: Workspace,
  records: readonly NotificationRecord[],
): Promise<Workspace> {
  const settings = await loadSettings();
  const enabled =
    settings.find((item) => item.key === 'notifications.showUnreadInTab')
      ?.value !== false;
  const count = enabled ? unreadCount(records) : undefined;
  const tabs = Object.fromEntries(
    Object.entries(workspace.tabs).map(([id, tab]) => [
      id,
      tab.kind === 'notifications' ? { ...tab, unreadCount: count } : tab,
    ]),
  );
  return { ...workspace, tabs };
}
