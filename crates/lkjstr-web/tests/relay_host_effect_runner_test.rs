#![cfg(target_arch = "wasm32")]

use lkjstr_protocol::{MessageErrorCode, RelayMessage};
use lkjstr_relays::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayClientEvent, RelayTimerKind,
};
use lkjstr_web::relay_host::{
    RelayEffectRunner, RelayHostAction, RelayHostEvent, RelayHostEventOutcome, RelaySocketMessage,
};
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn relay_effect_runner_maps_reducer_effects_to_host_actions() {
    let mut runner = RelayEffectRunner::default();
    let owner = runner.register_owner("tab-1", "wss://relay.example", "nip11:relay");

    let actions = runner.apply_effects(
        &owner,
        &[
            RelayClientEffect::OpenSocket,
            RelayClientEffect::SendFrame(r#"["REQ","sub",{}]"#.to_owned()),
            RelayClientEffect::ScheduleTimer {
                kind: RelayTimerKind::ConnectDeadline,
                delay_ms: 100,
            },
            RelayClientEffect::FetchNip11,
            RelayClientEffect::RecordDiagnostic {
                kind: RelayClientDiagnosticKind::SocketError,
                detail: "network".to_owned(),
            },
        ],
    );

    assert_eq!(
        actions,
        vec![
            RelayHostAction::OpenSocket {
                owner: owner.clone(),
                relay_url: "wss://relay.example".to_owned()
            },
            RelayHostAction::SendFrame {
                owner: owner.clone(),
                frame: r#"["REQ","sub",{}]"#.to_owned()
            },
            RelayHostAction::ScheduleTimer {
                owner: owner.clone(),
                kind: RelayTimerKind::ConnectDeadline,
                delay_ms: 100
            },
            RelayHostAction::FetchNip11 {
                owner: owner.clone(),
                relay_url: "wss://relay.example".to_owned(),
                request_key: "nip11:relay".to_owned()
            },
            RelayHostAction::EmitDiagnostic {
                owner,
                kind: RelayClientDiagnosticKind::SocketError,
                detail: "network".to_owned()
            }
        ]
    );
}

#[wasm_bindgen_test]
fn relay_effect_runner_feeds_typed_host_events_to_reducer() {
    let mut runner = RelayEffectRunner::default();
    let owner = runner.register_owner("tab-1", "wss://relay.example", "nip11:relay");

    assert_eq!(
        runner.map_host_event(&owner, RelayHostEvent::SocketOpened),
        reducer_event(RelayClientEvent::SocketOpened)
    );
    assert_eq!(
        runner.map_host_event(
            &owner,
            RelayHostEvent::SocketMessage(RelaySocketMessage::Relay(RelayMessage::Notice(
                "maintenance".to_owned()
            )))
        ),
        reducer_event(RelayClientEvent::RelayMessage {
            message: RelayMessage::Notice("maintenance".to_owned())
        })
    );
    assert_eq!(
        runner.map_host_event(
            &owner,
            RelayHostEvent::TimerElapsed {
                kind: RelayTimerKind::Reconnect
            }
        ),
        reducer_event(RelayClientEvent::ReconnectTimerElapsed)
    );
}

#[wasm_bindgen_test]
fn relay_effect_runner_reports_malformed_socket_messages() {
    let mut runner = RelayEffectRunner::default();
    let owner = runner.register_owner("tab-1", "wss://relay.example", "nip11:relay");

    let outcome = runner.map_host_event(
        &owner,
        RelayHostEvent::SocketMessage(RelaySocketMessage::ParseError {
            code: MessageErrorCode::BadJson,
            message: "relay message is not valid JSON".to_owned(),
        }),
    );

    assert_eq!(
        outcome,
        RelayHostEventOutcome {
            reducer_event: None,
            actions: vec![RelayHostAction::EmitDiagnostic {
                owner,
                kind: RelayClientDiagnosticKind::MalformedMessage,
                detail: "BadJson: relay message is not valid JSON".to_owned()
            }]
        }
    );
}

#[wasm_bindgen_test]
fn relay_effect_runner_rejects_closed_and_replaced_callback_owners() {
    let mut runner = RelayEffectRunner::default();
    let owner = runner.register_owner("tab-1", "wss://relay.example", "nip11:relay");
    let close = runner.apply_effect(&owner, RelayClientEffect::DropCallbackOwner);

    assert_eq!(
        close,
        vec![RelayHostAction::DropCallbackOwner {
            owner: owner.clone()
        }]
    );
    assert_eq!(
        runner.map_host_event(&owner, RelayHostEvent::SocketOpened),
        RelayHostEventOutcome {
            reducer_event: None,
            actions: vec![RelayHostAction::EmitDiagnostic {
                owner: owner.clone(),
                kind: RelayClientDiagnosticKind::IgnoredAfterClose,
                detail: "host-event".to_owned()
            }]
        }
    );

    let stale_owner = runner.register_owner("tab-2", "wss://old.example", "nip11:old");
    let fresh_owner = runner.register_owner("tab-2", "wss://new.example", "nip11:new");
    assert_eq!(
        runner.map_host_event(&stale_owner, RelayHostEvent::SocketOpened),
        RelayHostEventOutcome::default()
    );
    assert_eq!(
        runner.map_host_event(&fresh_owner, RelayHostEvent::SocketOpened),
        reducer_event(RelayClientEvent::SocketOpened)
    );
}

fn reducer_event(event: RelayClientEvent) -> RelayHostEventOutcome {
    RelayHostEventOutcome {
        reducer_event: Some(event),
        actions: Vec::new(),
    }
}
