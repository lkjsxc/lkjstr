use lkjstr_relays::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayClientEvent, RelayClientState,
    RelayConnectionState, RelayTimerKind, connect_deadline_ms, reconnect_delay_ms,
    reduce_relay_client,
};

#[test]
fn connect_request_opens_socket_and_schedules_deadline() {
    let mut state = RelayClientState::default();

    let effects = reduce_relay_client(&mut state, RelayClientEvent::ConnectRequested);

    assert_eq!(state.connection(), RelayConnectionState::Connecting);
    assert_eq!(
        effects,
        vec![
            RelayClientEffect::ClearTimer {
                kind: RelayTimerKind::Reconnect
            },
            RelayClientEffect::ScheduleTimer {
                kind: RelayTimerKind::ConnectDeadline,
                delay_ms: connect_deadline_ms()
            },
            RelayClientEffect::OpenSocket,
            RelayClientEffect::PublishSnapshot
        ]
    );
}

#[test]
fn queued_frames_flush_when_socket_opens() {
    let mut state = RelayClientState::default();
    reduce_relay_client(
        &mut state,
        RelayClientEvent::SendRequested {
            frame: "REQ-one".to_owned(),
        },
    );
    reduce_relay_client(
        &mut state,
        RelayClientEvent::SendRequested {
            frame: "REQ-two".to_owned(),
        },
    );

    let effects = reduce_relay_client(&mut state, RelayClientEvent::SocketOpened);

    assert_eq!(state.connection(), RelayConnectionState::Open);
    assert_eq!(state.queued_len(), 0);
    assert!(effects.contains(&RelayClientEffect::SendFrame("REQ-one".to_owned())));
    assert!(effects.contains(&RelayClientEffect::SendFrame("REQ-two".to_owned())));
}

#[test]
fn socket_error_with_pending_work_schedules_reconnect() {
    let mut state = RelayClientState::default();
    reduce_relay_client(
        &mut state,
        RelayClientEvent::SendRequested {
            frame: "REQ".to_owned(),
        },
    );

    let effects = reduce_relay_client(
        &mut state,
        RelayClientEvent::SocketError {
            reason: "network".to_owned(),
        },
    );

    assert_eq!(state.connection(), RelayConnectionState::Error);
    assert_eq!(state.last_problem(), Some("network"));
    assert_eq!(state.reconnect_attempts(), 1);
    assert!(effects.contains(&RelayClientEffect::ScheduleTimer {
        kind: RelayTimerKind::Reconnect,
        delay_ms: reconnect_delay_ms(0)
    }));
    assert!(effects.contains(&RelayClientEffect::RecordDiagnostic {
        kind: RelayClientDiagnosticKind::SocketError,
        detail: "network".to_owned()
    }));
}

#[test]
fn reconnect_timer_reopens_only_when_work_remains() {
    let mut state = RelayClientState::default();
    let idle = reduce_relay_client(&mut state, RelayClientEvent::ReconnectTimerElapsed);
    assert_eq!(
        idle,
        vec![RelayClientEffect::ClearTimer {
            kind: RelayTimerKind::Reconnect
        }]
    );

    reduce_relay_client(
        &mut state,
        RelayClientEvent::SendRequested {
            frame: "REQ".to_owned(),
        },
    );
    reduce_relay_client(
        &mut state,
        RelayClientEvent::SocketClosed {
            reason: "closed".to_owned(),
        },
    );
    let effects = reduce_relay_client(&mut state, RelayClientEvent::ReconnectTimerElapsed);

    assert_eq!(state.connection(), RelayConnectionState::Connecting);
    assert!(effects.contains(&RelayClientEffect::OpenSocket));
}

#[test]
fn final_close_clears_queue_and_ignores_later_send() {
    let mut state = RelayClientState::default();
    reduce_relay_client(
        &mut state,
        RelayClientEvent::SendRequested {
            frame: "REQ".to_owned(),
        },
    );

    let close = reduce_relay_client(&mut state, RelayClientEvent::OwnerClosed);
    let send = reduce_relay_client(
        &mut state,
        RelayClientEvent::SendRequested {
            frame: "late".to_owned(),
        },
    );

    assert!(state.final_closed());
    assert_eq!(state.queued_len(), 0);
    assert!(close.contains(&RelayClientEffect::DropCallbackOwner));
    assert_eq!(
        send,
        vec![RelayClientEffect::RecordDiagnostic {
            kind: RelayClientDiagnosticKind::IgnoredAfterClose,
            detail: "send".to_owned()
        }]
    );
}

#[test]
fn connect_deadline_closes_socket_and_reconnects_pending_work() {
    let mut state = RelayClientState::default();
    reduce_relay_client(
        &mut state,
        RelayClientEvent::SendRequested {
            frame: "REQ".to_owned(),
        },
    );

    let effects = reduce_relay_client(&mut state, RelayClientEvent::ConnectDeadlineElapsed);

    assert_eq!(state.connection(), RelayConnectionState::Error);
    assert_eq!(state.last_problem(), Some("connect-timeout"));
    assert!(effects.contains(&RelayClientEffect::CloseSocket));
    assert!(effects.contains(&RelayClientEffect::ScheduleTimer {
        kind: RelayTimerKind::Reconnect,
        delay_ms: reconnect_delay_ms(0)
    }));
}
