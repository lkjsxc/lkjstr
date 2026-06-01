use lkjstr_protocol::{NostrEvent, RelayMessage};
use lkjstr_relays::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayClientEvent, RelayClientState,
    max_relay_message_records, reduce_relay_client,
};

#[test]
fn relay_event_emits_event_effect_without_browser_work() {
    let mut state = RelayClientState::default();
    let event = event("a");

    let effects = reduce_relay_client(
        &mut state,
        RelayClientEvent::RelayMessage {
            message: RelayMessage::Event {
                subscription_id: "sub".to_owned(),
                event: event.clone(),
            },
        },
    );

    assert_eq!(
        effects,
        vec![
            RelayClientEffect::RelayEvent {
                subscription_id: "sub".to_owned(),
                event_id: event.id
            },
            RelayClientEffect::PublishSnapshot
        ]
    );
}

#[test]
fn eose_closed_and_ok_are_recorded() {
    let mut state = RelayClientState::default();

    reduce_relay_client(
        &mut state,
        RelayClientEvent::RelayMessage {
            message: RelayMessage::Eose("sub".to_owned()),
        },
    );
    let closed = reduce_relay_client(
        &mut state,
        RelayClientEvent::RelayMessage {
            message: RelayMessage::Closed {
                subscription_id: "sub".to_owned(),
                message: "limit: slow".to_owned(),
            },
        },
    );
    let ok = reduce_relay_client(
        &mut state,
        RelayClientEvent::RelayMessage {
            message: RelayMessage::Ok {
                event_id: hex64('b'),
                accepted: false,
                message: "blocked".to_owned(),
            },
        },
    );

    assert!(state.messages().eose_seen("sub"));
    assert_eq!(state.messages().closed_reason("sub"), Some("limit: slow"));
    assert_eq!(state.messages().ok_accepted(&hex64('b')), Some(false));
    assert!(closed.contains(&RelayClientEffect::RecordDiagnostic {
        kind: RelayClientDiagnosticKind::RelayClosed,
        detail: "sub: limit: slow".to_owned()
    }));
    assert!(ok.contains(&RelayClientEffect::RecordDiagnostic {
        kind: RelayClientDiagnosticKind::RelayOkRejected,
        detail: "blocked".to_owned()
    }));
}

#[test]
fn notices_and_auth_challenges_are_bounded() {
    let mut state = RelayClientState::default();

    for index in 0..(max_relay_message_records() + 4) {
        reduce_relay_client(
            &mut state,
            RelayClientEvent::RelayMessage {
                message: RelayMessage::Notice(format!("notice-{index}")),
            },
        );
        reduce_relay_client(
            &mut state,
            RelayClientEvent::RelayMessage {
                message: RelayMessage::Auth(format!("auth-{index}")),
            },
        );
    }

    assert_eq!(state.messages().notice_count(), max_relay_message_records());
    assert_eq!(state.messages().auth_count(), max_relay_message_records());
}

#[test]
fn final_close_ignores_late_relay_messages() {
    let mut state = RelayClientState::default();
    reduce_relay_client(&mut state, RelayClientEvent::OwnerClosed);

    let effects = reduce_relay_client(
        &mut state,
        RelayClientEvent::RelayMessage {
            message: RelayMessage::Eose("sub".to_owned()),
        },
    );

    assert!(!state.messages().eose_seen("sub"));
    assert_eq!(
        effects,
        vec![RelayClientEffect::RecordDiagnostic {
            kind: RelayClientDiagnosticKind::IgnoredAfterClose,
            detail: "relay-message".to_owned()
        }]
    );
}

fn event(id_prefix: &str) -> NostrEvent {
    NostrEvent {
        id: format!("{id_prefix}{}", "0".repeat(63)),
        pubkey: hex64('1'),
        created_at: 100,
        kind: 1,
        tags: Vec::new(),
        content: "relay event".to_owned(),
        sig: hex128('2'),
    }
}

fn hex64(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn hex128(character: char) -> String {
    std::iter::repeat_n(character, 128).collect()
}
