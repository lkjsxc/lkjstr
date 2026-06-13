use lkjstr_relays::{ProgressiveRelayState, ReadPageRelayStatus};

#[derive(Clone, Copy)]
pub(crate) enum RelayEnd {
    Connected,
    Reading,
    Eose,
    Closed,
    Auth,
    Error,
    EventLimit,
}

pub(crate) fn relay_status(relay: &str, end: RelayEnd, count: u64) -> ReadPageRelayStatus {
    ReadPageRelayStatus {
        relay: relay.to_owned(),
        eose: matches!(end, RelayEnd::Eose),
        timeout: false,
        closed: matches!(end, RelayEnd::Closed),
        auth: matches!(end, RelayEnd::Auth),
        socket_closed: false,
        socket_error: matches!(end, RelayEnd::Error),
        event_limit_reached: matches!(end, RelayEnd::EventLimit),
        aborted: false,
        duration_ms: 0,
        candidate_count: count,
        final_count: count,
    }
}

pub(crate) fn relay_terminal(state: ProgressiveRelayState) -> bool {
    matches!(
        state,
        ProgressiveRelayState::Eose
            | ProgressiveRelayState::Timeout
            | ProgressiveRelayState::Closed
            | ProgressiveRelayState::Auth
            | ProgressiveRelayState::Error
            | ProgressiveRelayState::Cancelled
    )
}
