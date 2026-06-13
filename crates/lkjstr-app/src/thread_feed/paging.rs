use crate::feed_scan::DEFAULT_INITIAL_SPAN_SECONDS;

pub const THREAD_MAX_AUTO_EMPTY_OLDER_REQUESTS: u8 = 4;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ThreadRelayCursor {
    pub since: u64,
    pub until: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ThreadHistoryExhaustion {
    Unknown,
    Probing,
    Proven,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ThreadOlderPageInput {
    pub older_cursor_created_at: u64,
    pub merged_oldest_created_at: Option<u64>,
    pub local_older_records_found: bool,
    pub incoming_records_found: bool,
    pub relay_read_complete: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ThreadOlderPageOutcome {
    pub cursor: ThreadRelayCursor,
    pub older_cursor_created_at: u64,
    pub has_older: bool,
    pub history_exhaustion: ThreadHistoryExhaustion,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ThreadOlderLoadTrigger {
    ViewportFill,
    NearEnd,
    Scroll,
    Explicit,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ThreadOlderIntentInput {
    pub has_older: bool,
    pub loading_older: bool,
    pub older_cursor_created_at: Option<u64>,
    pub trigger: ThreadOlderLoadTrigger,
    pub scrollable: bool,
    pub user_scrolled_down: bool,
    pub automatic_empty_requests: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ThreadOlderIntent {
    Request { older_cursor_created_at: u64 },
    Blocked(ThreadOlderBlockReason),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ThreadOlderBlockReason {
    NoOlderHistory,
    AlreadyLoading,
    MissingCursor,
    AutomaticEmptyCapReached,
    NeedsCurrentDownwardScroll,
}

#[must_use]
pub fn older_thread_cursor(oldest_created_at: u64) -> ThreadRelayCursor {
    ThreadRelayCursor {
        since: oldest_created_at.saturating_sub(DEFAULT_INITIAL_SPAN_SECONDS),
        until: oldest_created_at.saturating_sub(1),
    }
}

#[must_use]
pub const fn thread_cursor_contains(created_at: u64, cursor: ThreadRelayCursor) -> bool {
    created_at >= cursor.since && created_at <= cursor.until
}

#[must_use]
pub fn plan_thread_older_page(input: ThreadOlderPageInput) -> ThreadOlderPageOutcome {
    let cursor = older_thread_cursor(input.older_cursor_created_at);
    let found_records = input.local_older_records_found || input.incoming_records_found;
    let next_cursor = match (found_records, input.merged_oldest_created_at) {
        (true, Some(oldest)) => oldest,
        _ if input.relay_read_complete => cursor.since,
        _ => input.older_cursor_created_at,
    };
    let history_exhaustion = history_exhaustion(input, cursor, next_cursor);
    ThreadOlderPageOutcome {
        cursor,
        older_cursor_created_at: next_cursor,
        has_older: history_exhaustion != ThreadHistoryExhaustion::Proven,
        history_exhaustion,
    }
}

#[must_use]
pub fn plan_thread_older_intent(input: ThreadOlderIntentInput) -> ThreadOlderIntent {
    if !input.has_older {
        return blocked(ThreadOlderBlockReason::NoOlderHistory);
    }
    if input.loading_older {
        return blocked(ThreadOlderBlockReason::AlreadyLoading);
    }
    let Some(cursor) = input.older_cursor_created_at else {
        return blocked(ThreadOlderBlockReason::MissingCursor);
    };
    match input.trigger {
        ThreadOlderLoadTrigger::Explicit => request(cursor),
        ThreadOlderLoadTrigger::Scroll if input.user_scrolled_down => request(cursor),
        ThreadOlderLoadTrigger::Scroll => {
            blocked(ThreadOlderBlockReason::NeedsCurrentDownwardScroll)
        }
        ThreadOlderLoadTrigger::ViewportFill | ThreadOlderLoadTrigger::NearEnd => {
            automatic_intent(input, cursor)
        }
    }
}

fn history_exhaustion(
    input: ThreadOlderPageInput,
    cursor: ThreadRelayCursor,
    next_cursor: u64,
) -> ThreadHistoryExhaustion {
    if cursor.since == 0 && !input.local_older_records_found && input.relay_read_complete {
        ThreadHistoryExhaustion::Proven
    } else if next_cursor == input.older_cursor_created_at {
        ThreadHistoryExhaustion::Unknown
    } else {
        ThreadHistoryExhaustion::Probing
    }
}

fn automatic_intent(input: ThreadOlderIntentInput, cursor: u64) -> ThreadOlderIntent {
    if input.scrollable {
        return blocked(ThreadOlderBlockReason::NeedsCurrentDownwardScroll);
    }
    if input.automatic_empty_requests >= THREAD_MAX_AUTO_EMPTY_OLDER_REQUESTS {
        return blocked(ThreadOlderBlockReason::AutomaticEmptyCapReached);
    }
    request(cursor)
}

const fn request(cursor: u64) -> ThreadOlderIntent {
    ThreadOlderIntent::Request {
        older_cursor_created_at: cursor,
    }
}

const fn blocked(reason: ThreadOlderBlockReason) -> ThreadOlderIntent {
    ThreadOlderIntent::Blocked(reason)
}
