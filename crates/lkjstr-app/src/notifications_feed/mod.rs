#![doc = "Pure Notifications feed view-model composition."]

mod build;
mod defaults;
mod paging;
mod types;

pub use build::{build_notifications_feed_view, notifications_feed_id};
pub use defaults::default_notifications_feed_view;
pub use paging::{
    NOTIFICATION_CLOCK_SKEW_SECONDS, NOTIFICATION_MAX_AUTO_EMPTY_OLDER_REQUESTS,
    NotificationRelayCursor, NotificationsHistoryExhaustion, NotificationsOlderBlockReason,
    NotificationsOlderIntent, NotificationsOlderIntentInput, NotificationsOlderLoadTrigger,
    NotificationsOlderPageInput, NotificationsOlderPageOutcome, initial_notification_cursor,
    notification_cursor_contains, older_notification_cursor, plan_notifications_older_intent,
    plan_notifications_older_page,
};
pub use types::{
    NotificationItemInput, NotificationsFeedDiagnosticInput, NotificationsFeedSourceState,
    NotificationsFeedStatus, NotificationsFeedView, NotificationsFeedViewInput,
};
