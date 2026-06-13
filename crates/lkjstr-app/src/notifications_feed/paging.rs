use crate::DEFAULT_INITIAL_SPAN_SECONDS;

pub const NOTIFICATION_CLOCK_SKEW_SECONDS: u64 = 120;
pub const NOTIFICATION_MAX_AUTO_EMPTY_OLDER_REQUESTS: u8 = 4;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NotificationRelayCursor {
    pub since: u64,
    pub until: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NotificationsHistoryExhaustion {
    Unknown,
    Probing,
    Proven,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NotificationsOlderPageInput {
    pub older_cursor_created_at: u64,
    pub merged_oldest_created_at: Option<u64>,
    pub local_older_records_found: bool,
    pub incoming_records_found: bool,
    pub relay_read_complete: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NotificationsOlderPageOutcome {
    pub cursor: NotificationRelayCursor,
    pub older_cursor_created_at: u64,
    pub has_older: bool,
    pub history_exhaustion: NotificationsHistoryExhaustion,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NotificationsOlderLoadTrigger {
    ViewportFill,
    NearEnd,
    Scroll,
    Explicit,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NotificationsOlderIntentInput {
    pub has_older: bool,
    pub loading_older: bool,
    pub older_cursor_created_at: Option<u64>,
    pub trigger: NotificationsOlderLoadTrigger,
    pub scrollable: bool,
    pub user_scrolled_down: bool,
    pub automatic_empty_requests: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NotificationsOlderIntent {
    Request { older_cursor_created_at: u64 },
    Blocked(NotificationsOlderBlockReason),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NotificationsOlderBlockReason {
    NoOlderHistory,
    AlreadyLoading,
    MissingCursor,
    AutomaticEmptyCapReached,
    NeedsCurrentDownwardScroll,
}

#[must_use]
pub fn initial_notification_cursor(started_at: u64) -> NotificationRelayCursor {
    NotificationRelayCursor {
        since: started_at.saturating_sub(DEFAULT_INITIAL_SPAN_SECONDS),
        until: started_at.saturating_add(NOTIFICATION_CLOCK_SKEW_SECONDS),
    }
}

#[must_use]
pub fn older_notification_cursor(oldest_created_at: u64) -> NotificationRelayCursor {
    NotificationRelayCursor {
        since: oldest_created_at.saturating_sub(DEFAULT_INITIAL_SPAN_SECONDS),
        until: oldest_created_at.saturating_sub(1),
    }
}

#[must_use]
pub const fn notification_cursor_contains(
    created_at: u64,
    cursor: NotificationRelayCursor,
) -> bool {
    created_at >= cursor.since && created_at <= cursor.until
}

#[must_use]
pub fn plan_notifications_older_page(
    input: NotificationsOlderPageInput,
) -> NotificationsOlderPageOutcome {
    let cursor = older_notification_cursor(input.older_cursor_created_at);
    let found_records = input.local_older_records_found || input.incoming_records_found;
    let next_cursor = match (found_records, input.merged_oldest_created_at) {
        (true, Some(oldest)) => oldest,
        _ if input.relay_read_complete => cursor.since,
        _ => input.older_cursor_created_at,
    };
    let history_exhaustion = history_exhaustion(input, cursor, next_cursor);
    NotificationsOlderPageOutcome {
        cursor,
        older_cursor_created_at: next_cursor,
        has_older: history_exhaustion != NotificationsHistoryExhaustion::Proven,
        history_exhaustion,
    }
}

#[must_use]
pub fn plan_notifications_older_intent(
    input: NotificationsOlderIntentInput,
) -> NotificationsOlderIntent {
    if !input.has_older {
        return blocked(NotificationsOlderBlockReason::NoOlderHistory);
    }
    if input.loading_older {
        return blocked(NotificationsOlderBlockReason::AlreadyLoading);
    }
    let Some(cursor) = input.older_cursor_created_at else {
        return blocked(NotificationsOlderBlockReason::MissingCursor);
    };
    match input.trigger {
        NotificationsOlderLoadTrigger::Explicit => request(cursor),
        NotificationsOlderLoadTrigger::Scroll if input.user_scrolled_down => request(cursor),
        NotificationsOlderLoadTrigger::Scroll => {
            blocked(NotificationsOlderBlockReason::NeedsCurrentDownwardScroll)
        }
        NotificationsOlderLoadTrigger::ViewportFill | NotificationsOlderLoadTrigger::NearEnd => {
            automatic_intent(input, cursor)
        }
    }
}

fn history_exhaustion(
    input: NotificationsOlderPageInput,
    cursor: NotificationRelayCursor,
    next_cursor: u64,
) -> NotificationsHistoryExhaustion {
    if cursor.since == 0 && !input.local_older_records_found && input.relay_read_complete {
        NotificationsHistoryExhaustion::Proven
    } else if next_cursor == input.older_cursor_created_at {
        NotificationsHistoryExhaustion::Unknown
    } else {
        NotificationsHistoryExhaustion::Probing
    }
}

fn automatic_intent(input: NotificationsOlderIntentInput, cursor: u64) -> NotificationsOlderIntent {
    if input.scrollable {
        return blocked(NotificationsOlderBlockReason::NeedsCurrentDownwardScroll);
    }
    if input.automatic_empty_requests >= NOTIFICATION_MAX_AUTO_EMPTY_OLDER_REQUESTS {
        return blocked(NotificationsOlderBlockReason::AutomaticEmptyCapReached);
    }
    request(cursor)
}

const fn request(cursor: u64) -> NotificationsOlderIntent {
    NotificationsOlderIntent::Request {
        older_cursor_created_at: cursor,
    }
}

const fn blocked(reason: NotificationsOlderBlockReason) -> NotificationsOlderIntent {
    NotificationsOlderIntent::Blocked(reason)
}
