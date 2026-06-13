use crate::DEFAULT_INITIAL_SPAN_SECONDS;

pub const GLOBAL_MAX_AUTO_EMPTY_OLDER_REQUESTS: u8 = 4;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GlobalRelayCursor {
    pub since: u64,
    pub until: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GlobalHistoryExhaustion {
    Unknown,
    Probing,
    Proven,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GlobalOlderPageInput {
    pub older_cursor_created_at: u64,
    pub merged_oldest_created_at: Option<u64>,
    pub local_older_records_found: bool,
    pub incoming_records_found: bool,
    pub relay_read_complete: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GlobalOlderPageOutcome {
    pub cursor: GlobalRelayCursor,
    pub older_cursor_created_at: u64,
    pub has_older: bool,
    pub history_exhaustion: GlobalHistoryExhaustion,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GlobalOlderLoadTrigger {
    ViewportFill,
    NearEnd,
    Scroll,
    Explicit,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GlobalOlderIntentInput {
    pub has_older: bool,
    pub loading_older: bool,
    pub older_cursor_created_at: Option<u64>,
    pub trigger: GlobalOlderLoadTrigger,
    pub scrollable: bool,
    pub user_scrolled_down: bool,
    pub automatic_empty_requests: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GlobalOlderIntent {
    Request { older_cursor_created_at: u64 },
    Blocked(GlobalOlderBlockReason),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GlobalOlderBlockReason {
    NoOlderHistory,
    AlreadyLoading,
    MissingCursor,
    AutomaticEmptyCapReached,
    NeedsCurrentDownwardScroll,
}

#[must_use]
pub fn older_global_cursor(oldest_created_at: u64) -> GlobalRelayCursor {
    GlobalRelayCursor {
        since: oldest_created_at.saturating_sub(DEFAULT_INITIAL_SPAN_SECONDS),
        until: oldest_created_at.saturating_sub(1),
    }
}

#[must_use]
pub const fn global_cursor_contains(created_at: u64, cursor: GlobalRelayCursor) -> bool {
    created_at >= cursor.since && created_at <= cursor.until
}

#[must_use]
pub fn plan_global_older_page(input: GlobalOlderPageInput) -> GlobalOlderPageOutcome {
    let cursor = older_global_cursor(input.older_cursor_created_at);
    let found_records = input.local_older_records_found || input.incoming_records_found;
    let next_cursor = match (found_records, input.merged_oldest_created_at) {
        (true, Some(oldest)) => oldest,
        _ if input.relay_read_complete => cursor.since,
        _ => input.older_cursor_created_at,
    };
    let history_exhaustion = history_exhaustion(input, cursor, next_cursor);
    GlobalOlderPageOutcome {
        cursor,
        older_cursor_created_at: next_cursor,
        has_older: history_exhaustion != GlobalHistoryExhaustion::Proven,
        history_exhaustion,
    }
}

#[must_use]
pub fn plan_global_older_intent(input: GlobalOlderIntentInput) -> GlobalOlderIntent {
    if !input.has_older {
        return blocked(GlobalOlderBlockReason::NoOlderHistory);
    }
    if input.loading_older {
        return blocked(GlobalOlderBlockReason::AlreadyLoading);
    }
    let Some(cursor) = input.older_cursor_created_at else {
        return blocked(GlobalOlderBlockReason::MissingCursor);
    };
    match input.trigger {
        GlobalOlderLoadTrigger::Explicit => request(cursor),
        GlobalOlderLoadTrigger::Scroll if input.user_scrolled_down => request(cursor),
        GlobalOlderLoadTrigger::Scroll => {
            blocked(GlobalOlderBlockReason::NeedsCurrentDownwardScroll)
        }
        GlobalOlderLoadTrigger::ViewportFill | GlobalOlderLoadTrigger::NearEnd => {
            automatic_intent(input, cursor)
        }
    }
}

fn history_exhaustion(
    input: GlobalOlderPageInput,
    cursor: GlobalRelayCursor,
    next_cursor: u64,
) -> GlobalHistoryExhaustion {
    if cursor.since == 0 && !input.local_older_records_found && input.relay_read_complete {
        GlobalHistoryExhaustion::Proven
    } else if next_cursor == input.older_cursor_created_at {
        GlobalHistoryExhaustion::Unknown
    } else {
        GlobalHistoryExhaustion::Probing
    }
}

fn automatic_intent(input: GlobalOlderIntentInput, cursor: u64) -> GlobalOlderIntent {
    if input.scrollable {
        return blocked(GlobalOlderBlockReason::NeedsCurrentDownwardScroll);
    }
    if input.automatic_empty_requests >= GLOBAL_MAX_AUTO_EMPTY_OLDER_REQUESTS {
        return blocked(GlobalOlderBlockReason::AutomaticEmptyCapReached);
    }
    request(cursor)
}

const fn request(cursor: u64) -> GlobalOlderIntent {
    GlobalOlderIntent::Request {
        older_cursor_created_at: cursor,
    }
}

const fn blocked(reason: GlobalOlderBlockReason) -> GlobalOlderIntent {
    GlobalOlderIntent::Blocked(reason)
}
