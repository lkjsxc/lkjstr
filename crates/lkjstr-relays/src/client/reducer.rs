use crate::client::effect::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayTimerKind, clear_timer, diagnostic,
};
use crate::client::event::RelayClientEvent;
use crate::client::state::{RelayClientState, RelayConnectionState};
use crate::client::transition::{final_close, schedule_reconnect_if_needed, start_connect};

pub fn reduce_relay_client(
    state: &mut RelayClientState,
    event: RelayClientEvent,
) -> Vec<RelayClientEffect> {
    match event {
        RelayClientEvent::ConnectRequested => connect_requested(state),
        RelayClientEvent::SocketOpened => socket_opened(state),
        RelayClientEvent::SocketMessage { frame } => socket_message(state, frame),
        RelayClientEvent::SocketError { reason } => socket_error(state, reason),
        RelayClientEvent::SocketClosed { reason } => socket_closed(state, reason),
        RelayClientEvent::SendRequested { frame } => send_requested(state, frame),
        RelayClientEvent::ReconnectTimerElapsed => reconnect_timer_elapsed(state),
        RelayClientEvent::ConnectDeadlineElapsed => connect_deadline_elapsed(state),
        RelayClientEvent::CloseRequested { reason } => final_close(state, Some(reason)),
        RelayClientEvent::OwnerClosed => final_close(state, None),
    }
}

fn connect_requested(state: &mut RelayClientState) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return vec![diagnostic(
            RelayClientDiagnosticKind::IgnoredAfterClose,
            "connect",
        )];
    }
    if matches!(
        state.connection,
        RelayConnectionState::Connecting | RelayConnectionState::Open
    ) {
        return vec![RelayClientEffect::PublishSnapshot];
    }
    start_connect(state)
}

fn socket_opened(state: &mut RelayClientState) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return vec![
            RelayClientEffect::CloseSocket,
            RelayClientEffect::DropCallbackOwner,
        ];
    }
    state.connection = RelayConnectionState::Open;
    state.reconnect_attempts = 0;
    state.last_problem = None;
    let mut effects = vec![
        clear_timer(RelayTimerKind::ConnectDeadline),
        clear_timer(RelayTimerKind::Reconnect),
    ];
    effects.extend(
        state
            .queue
            .drain()
            .into_iter()
            .map(RelayClientEffect::SendFrame),
    );
    effects.push(RelayClientEffect::PublishSnapshot);
    effects
}

fn socket_message(state: &RelayClientState, frame: String) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return vec![diagnostic(
            RelayClientDiagnosticKind::IgnoredAfterClose,
            "message",
        )];
    }
    vec![
        RelayClientEffect::InboundFrame(frame),
        RelayClientEffect::PublishSnapshot,
    ]
}

fn socket_error(state: &mut RelayClientState, reason: String) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return Vec::new();
    }
    state.connection = RelayConnectionState::Error;
    state.last_problem = Some(reason.clone());
    let mut effects = vec![
        clear_timer(RelayTimerKind::ConnectDeadline),
        diagnostic(RelayClientDiagnosticKind::SocketError, reason),
    ];
    schedule_reconnect_if_needed(state, &mut effects);
    effects.push(RelayClientEffect::PublishSnapshot);
    effects
}

fn socket_closed(state: &mut RelayClientState, reason: String) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return final_close(state, Some(reason));
    }
    state.connection = RelayConnectionState::Closed;
    state.last_problem = Some(reason.clone());
    let mut effects = vec![
        clear_timer(RelayTimerKind::ConnectDeadline),
        diagnostic(RelayClientDiagnosticKind::SocketClosed, reason),
    ];
    schedule_reconnect_if_needed(state, &mut effects);
    effects.push(RelayClientEffect::PublishSnapshot);
    effects
}

fn send_requested(state: &mut RelayClientState, frame: String) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return vec![diagnostic(
            RelayClientDiagnosticKind::IgnoredAfterClose,
            "send",
        )];
    }
    if state.connection == RelayConnectionState::Open {
        return vec![RelayClientEffect::SendFrame(frame)];
    }
    if !state.queue.enqueue(frame) {
        return vec![diagnostic(RelayClientDiagnosticKind::QueueFull, "send")];
    }
    if state.connection == RelayConnectionState::Connecting {
        vec![RelayClientEffect::PublishSnapshot]
    } else {
        start_connect(state)
    }
}

fn reconnect_timer_elapsed(state: &mut RelayClientState) -> Vec<RelayClientEffect> {
    if state.final_closed || state.queue.is_empty() {
        return vec![clear_timer(RelayTimerKind::Reconnect)];
    }
    start_connect(state)
}

fn connect_deadline_elapsed(state: &mut RelayClientState) -> Vec<RelayClientEffect> {
    if state.connection != RelayConnectionState::Connecting || state.final_closed {
        return Vec::new();
    }
    state.connection = RelayConnectionState::Error;
    state.last_problem = Some("connect-timeout".to_owned());
    let mut effects = vec![
        RelayClientEffect::CloseSocket,
        clear_timer(RelayTimerKind::ConnectDeadline),
        diagnostic(RelayClientDiagnosticKind::ConnectTimeout, "connect-timeout"),
    ];
    schedule_reconnect_if_needed(state, &mut effects);
    effects.push(RelayClientEffect::PublishSnapshot);
    effects
}
