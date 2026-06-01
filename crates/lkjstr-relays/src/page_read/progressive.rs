#![doc = "Progressive read reducer and selectors."]

use std::collections::BTreeMap;

use super::progressive_tail::{
    pending_relay, relay_reason, relay_snapshot, relay_state_from_status, terminal_status,
    terminal_without_error, timeout_relays, with_status,
};
use super::{
    InitialProgressiveRead, ProgressiveReadEvidence, ProgressiveReadSnapshot, ProgressiveReadState,
    ProgressiveReadStatus, ProgressiveRelaySnapshot, ProgressiveRelayState, ReadPageRelayStatus,
    merge_progressive_events,
};

#[must_use]
pub fn initial_progressive_read(input: InitialProgressiveRead) -> ProgressiveReadState {
    let relay_states = input
        .relays
        .iter()
        .map(|relay| (relay.clone(), pending_relay(relay)))
        .collect::<BTreeMap<_, _>>();
    let state = ProgressiveReadState {
        read_id: input.read_id,
        surface: input.surface,
        started_at_ms: input.started_at_ms,
        relays: input.relays,
        events: Vec::new(),
        relay_states,
        cache_ready: false,
        final_read: false,
        status: ProgressiveReadStatus::Idle,
    };
    with_status(state)
}

#[must_use]
pub fn reduce_progressive_read(
    state: ProgressiveReadState,
    evidence: ProgressiveReadEvidence,
) -> ProgressiveReadState {
    if state.status == ProgressiveReadStatus::Cancelled {
        return state;
    }
    with_status(apply_evidence(state, evidence))
}

#[must_use]
pub fn progressive_read_snapshot(
    state: &ProgressiveReadState,
    reason: impl Into<String>,
    now_ms: u64,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: state.read_id.clone(),
        surface: state.surface,
        status: state.status,
        reason: reason.into(),
        events: state.events.clone(),
        relays: state
            .relays
            .iter()
            .map(|relay| relay_snapshot(state, relay))
            .collect(),
        started_at_ms: state.started_at_ms,
        updated_at_ms: now_ms,
        duration_ms: now_ms.saturating_sub(state.started_at_ms),
        final_read: state.final_read,
    }
}

#[must_use]
pub fn progressive_status(state: &ProgressiveReadState) -> ProgressiveReadStatus {
    let relays = state.relay_states.values().collect::<Vec<_>>();
    if relays
        .iter()
        .any(|relay| relay.state == ProgressiveRelayState::Cancelled)
    {
        return ProgressiveReadStatus::Cancelled;
    }
    if state.final_read
        && relays
            .iter()
            .all(|relay| relay.state == ProgressiveRelayState::Eose)
    {
        return ProgressiveReadStatus::Complete;
    }
    if state.final_read
        && relays
            .iter()
            .any(|relay| terminal_without_error(relay.state))
    {
        return terminal_status(!state.events.is_empty());
    }
    if state.final_read
        && relays
            .iter()
            .any(|relay| relay.state == ProgressiveRelayState::Error)
    {
        return terminal_status(!state.events.is_empty());
    }
    if !state.events.is_empty() {
        return ProgressiveReadStatus::Partial;
    }
    if state.cache_ready {
        return ProgressiveReadStatus::CacheReady;
    }
    ProgressiveReadStatus::Idle
}

#[must_use]
pub fn relay_snapshot_from_status(status: &ReadPageRelayStatus) -> ProgressiveRelaySnapshot {
    ProgressiveRelaySnapshot {
        relay: status.relay.clone(),
        state: relay_state_from_status(status),
        event_count: status.candidate_count,
        final_count: status.final_count,
        duration_ms: Some(status.duration_ms),
        reason: relay_reason(status).map(str::to_owned),
    }
}

fn apply_evidence(
    state: ProgressiveReadState,
    evidence: ProgressiveReadEvidence,
) -> ProgressiveReadState {
    match evidence {
        ProgressiveReadEvidence::CacheReady(events) => ProgressiveReadState {
            cache_ready: true,
            events: merge_progressive_events(&state.events, &events),
            ..state
        },
        ProgressiveReadEvidence::RelayEvents(events) => ProgressiveReadState {
            events: merge_progressive_events(&state.events, &events),
            ..state
        },
        ProgressiveReadEvidence::RelayStatuses(statuses) => ProgressiveReadState {
            relay_states: merge_relay_statuses(&state, &statuses),
            ..state
        },
        ProgressiveReadEvidence::Finalize(statuses) => ProgressiveReadState {
            final_read: true,
            relay_states: merge_relay_statuses(&state, &statuses),
            ..state
        },
        ProgressiveReadEvidence::Cancel => ProgressiveReadState {
            final_read: true,
            relay_states: cancel_relays(&state),
            ..state
        },
        ProgressiveReadEvidence::Timeout => ProgressiveReadState {
            final_read: true,
            relay_states: timeout_relays(&state),
            ..state
        },
    }
}

fn merge_relay_statuses(
    state: &ProgressiveReadState,
    statuses: &[ReadPageRelayStatus],
) -> BTreeMap<String, ProgressiveRelaySnapshot> {
    let mut relay_states = state.relay_states.clone();
    for status in statuses {
        relay_states.insert(status.relay.clone(), relay_snapshot_from_status(status));
    }
    relay_states
}

fn cancel_relays(state: &ProgressiveReadState) -> BTreeMap<String, ProgressiveRelaySnapshot> {
    state
        .relays
        .iter()
        .map(|relay| {
            let mut snapshot = relay_snapshot(state, relay);
            snapshot.state = ProgressiveRelayState::Cancelled;
            snapshot.reason = Some("cancelled".to_owned());
            (relay.clone(), snapshot)
        })
        .collect()
}
