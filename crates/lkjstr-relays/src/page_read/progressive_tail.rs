#![doc = "Progressive read reducer helpers."]

use std::collections::BTreeMap;

use super::{
    ProgressiveReadState, ProgressiveReadStatus, ProgressiveRelaySnapshot, ProgressiveRelayState,
    ReadPageRelayStatus, progressive_status,
};

pub(super) fn timeout_relays(
    state: &ProgressiveReadState,
) -> BTreeMap<String, ProgressiveRelaySnapshot> {
    state
        .relays
        .iter()
        .map(|relay| {
            let mut snapshot = relay_snapshot(state, relay);
            if snapshot.state != ProgressiveRelayState::Eose {
                snapshot.state = ProgressiveRelayState::Timeout;
            }
            (relay.clone(), snapshot)
        })
        .collect()
}

pub(super) fn relay_snapshot(
    state: &ProgressiveReadState,
    relay: &str,
) -> ProgressiveRelaySnapshot {
    match state.relay_states.get(relay) {
        Some(snapshot) => snapshot.clone(),
        None => pending_relay(relay),
    }
}

pub(super) fn pending_relay(relay: &str) -> ProgressiveRelaySnapshot {
    ProgressiveRelaySnapshot {
        relay: relay.to_owned(),
        state: ProgressiveRelayState::Pending,
        event_count: 0,
        final_count: 0,
        duration_ms: None,
        reason: None,
    }
}

pub(super) fn with_status(mut state: ProgressiveReadState) -> ProgressiveReadState {
    state.status = progressive_status(&state);
    state
}

pub(super) fn terminal_without_error(state: ProgressiveRelayState) -> bool {
    matches!(
        state,
        ProgressiveRelayState::Timeout
            | ProgressiveRelayState::Closed
            | ProgressiveRelayState::Auth
    )
}

pub(super) fn terminal_status(has_events: bool) -> ProgressiveReadStatus {
    if has_events {
        ProgressiveReadStatus::Incomplete
    } else {
        ProgressiveReadStatus::Failed
    }
}

pub(super) fn relay_state_from_status(status: &ReadPageRelayStatus) -> ProgressiveRelayState {
    if status.aborted {
        return ProgressiveRelayState::Cancelled;
    }
    if status.auth {
        return ProgressiveRelayState::Auth;
    }
    if status.closed || status.socket_closed {
        return ProgressiveRelayState::Closed;
    }
    if status.socket_error {
        return ProgressiveRelayState::Error;
    }
    if status.timeout || status.event_limit_reached {
        return ProgressiveRelayState::Timeout;
    }
    if status.eose {
        return ProgressiveRelayState::Eose;
    }
    if status.candidate_count > 0 {
        return ProgressiveRelayState::Reading;
    }
    ProgressiveRelayState::Connected
}

pub(super) fn relay_reason(status: &ReadPageRelayStatus) -> Option<&'static str> {
    if status.aborted {
        return Some("cancelled");
    }
    if status.auth {
        return Some("auth");
    }
    if status.socket_error {
        return Some("socket-error");
    }
    if status.closed || status.socket_closed {
        return Some("closed");
    }
    if status.event_limit_reached {
        return Some("event-limit");
    }
    if status.timeout {
        return Some("timeout");
    }
    None
}
