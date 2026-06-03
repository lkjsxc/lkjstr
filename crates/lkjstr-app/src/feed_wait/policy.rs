pub const FIRST_PAINT_DELAY_MS: u64 = 350;
pub const CONTEXT_UNAVAILABLE_WAIT_MS: u64 = 700;
pub const FOREGROUND_MERGE_WINDOW_MS: u64 = 8_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedWaitState {
    Checking,
    Rows,
    IncompleteRows,
    Empty,
    TimeoutUnavailable,
    ContextUnavailable,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedWaitInput {
    pub now_ms: u64,
    pub read_started_at_ms: u64,
    pub cache_row_count: usize,
    pub relay_row_count: usize,
    pub relays_pending: bool,
    pub contacted_relays_terminal: bool,
    pub complete_coverage_proves_absence: bool,
    pub timeout: bool,
    pub exact_context_read: bool,
    pub generation: u64,
    pub current_generation: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedWaitDecision {
    pub paint: bool,
    pub state: FeedWaitState,
}

#[must_use]
pub fn decide_feed_wait(input: &FeedWaitInput) -> FeedWaitDecision {
    if input.generation != input.current_generation {
        return decision(false, FeedWaitState::Cancelled);
    }
    let rows = input.cache_row_count + input.relay_row_count;
    if rows > 0 {
        return decision(true, rows_state(input));
    }
    if terminal_empty(input) {
        return decision(true, FeedWaitState::Empty);
    }
    if input.timeout && !input.relays_pending {
        return decision(true, FeedWaitState::TimeoutUnavailable);
    }
    if context_wait_elapsed(input) {
        return decision(true, FeedWaitState::ContextUnavailable);
    }
    decision(first_paint_elapsed(input), FeedWaitState::Checking)
}

#[must_use]
pub fn within_foreground_merge_window(started_at_ms: u64, now_ms: u64) -> bool {
    now_ms.saturating_sub(started_at_ms) <= FOREGROUND_MERGE_WINDOW_MS
}

fn rows_state(input: &FeedWaitInput) -> FeedWaitState {
    if input.relays_pending || input.timeout {
        FeedWaitState::IncompleteRows
    } else {
        FeedWaitState::Rows
    }
}

fn terminal_empty(input: &FeedWaitInput) -> bool {
    input.complete_coverage_proves_absence
        || (input.contacted_relays_terminal && !input.relays_pending && !input.timeout)
}

fn context_wait_elapsed(input: &FeedWaitInput) -> bool {
    input.exact_context_read
        && input
            .now_ms
            .saturating_sub(input.read_started_at_ms)
            .ge(&CONTEXT_UNAVAILABLE_WAIT_MS)
}

fn first_paint_elapsed(input: &FeedWaitInput) -> bool {
    input
        .now_ms
        .saturating_sub(input.read_started_at_ms)
        .ge(&FIRST_PAINT_DELAY_MS)
}

fn decision(paint: bool, state: FeedWaitState) -> FeedWaitDecision {
    FeedWaitDecision { paint, state }
}
