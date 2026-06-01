use crate::client::effect::{
    RelayClientEffect, RelayTimerKind, clear_timer, connect_deadline_ms, reconnect_base_delay_ms,
    reconnect_max_delay_ms, schedule_timer,
};
use crate::client::state::{RelayClientState, RelayConnectionState};

#[must_use]
pub fn reconnect_delay_ms(attempt: u32) -> u32 {
    let factor = 2_u32.saturating_pow(attempt.min(5));
    reconnect_base_delay_ms()
        .saturating_mul(factor)
        .min(reconnect_max_delay_ms())
}

pub(super) fn final_close(
    state: &mut RelayClientState,
    detail: Option<String>,
) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return Vec::new();
    }
    state.final_closed = true;
    state.connection = RelayConnectionState::Closed;
    state.reconnect_attempts = 0;
    state.last_problem = detail;
    state.queue.clear();
    vec![
        clear_timer(RelayTimerKind::ConnectDeadline),
        clear_timer(RelayTimerKind::Reconnect),
        RelayClientEffect::CloseSocket,
        RelayClientEffect::DropCallbackOwner,
        RelayClientEffect::PublishSnapshot,
    ]
}

pub(super) fn start_connect(state: &mut RelayClientState) -> Vec<RelayClientEffect> {
    state.connection = RelayConnectionState::Connecting;
    vec![
        clear_timer(RelayTimerKind::Reconnect),
        schedule_timer(RelayTimerKind::ConnectDeadline, connect_deadline_ms()),
        RelayClientEffect::OpenSocket,
        RelayClientEffect::PublishSnapshot,
    ]
}

pub(super) fn schedule_reconnect_if_needed(
    state: &mut RelayClientState,
    effects: &mut Vec<RelayClientEffect>,
) {
    if state.queue.is_empty() {
        return;
    }
    let delay = reconnect_delay_ms(state.reconnect_attempts);
    state.reconnect_attempts = state.reconnect_attempts.saturating_add(1);
    effects.push(schedule_timer(RelayTimerKind::Reconnect, delay));
}
