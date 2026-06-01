use lkjstr_protocol::RelayMessage;

use crate::client::effect::{RelayClientDiagnosticKind, RelayClientEffect, diagnostic};
use crate::client::state::RelayClientState;

pub(super) fn relay_message(
    state: &mut RelayClientState,
    message: RelayMessage,
) -> Vec<RelayClientEffect> {
    if state.final_closed {
        return vec![diagnostic(
            RelayClientDiagnosticKind::IgnoredAfterClose,
            "relay-message",
        )];
    }
    match message {
        RelayMessage::Event {
            subscription_id,
            event,
        } => vec![
            RelayClientEffect::RelayEvent {
                subscription_id,
                event_id: event.id,
            },
            RelayClientEffect::PublishSnapshot,
        ],
        RelayMessage::Eose(subscription_id) => {
            state.messages.record_eose(subscription_id);
            vec![RelayClientEffect::PublishSnapshot]
        }
        RelayMessage::Closed {
            subscription_id,
            message,
        } => {
            state
                .messages
                .record_closed(subscription_id.clone(), message.clone());
            vec![
                diagnostic(
                    RelayClientDiagnosticKind::RelayClosed,
                    format!("{subscription_id}: {message}"),
                ),
                RelayClientEffect::PublishSnapshot,
            ]
        }
        RelayMessage::Ok {
            event_id,
            accepted,
            message,
        } => {
            state.messages.record_ok(event_id, accepted);
            ok_effects(accepted, message)
        }
        RelayMessage::Notice(message) => {
            state.messages.record_notice(message.clone());
            vec![diagnostic(RelayClientDiagnosticKind::RelayNotice, message)]
        }
        RelayMessage::Auth(challenge) => {
            state.messages.record_auth(challenge.clone());
            vec![diagnostic(RelayClientDiagnosticKind::RelayAuth, challenge)]
        }
    }
}

fn ok_effects(accepted: bool, message: String) -> Vec<RelayClientEffect> {
    if accepted {
        return vec![RelayClientEffect::PublishSnapshot];
    }
    vec![
        diagnostic(RelayClientDiagnosticKind::RelayOkRejected, message),
        RelayClientEffect::PublishSnapshot,
    ]
}
