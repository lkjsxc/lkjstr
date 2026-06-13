use lkjstr_relays::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayClientEvent, RelayTimerKind,
};

use crate::relay_host::{RelaySocketEvent, RelaySocketMessage};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayHostOwner {
    pub id: String,
    pub generation: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayHostEffectContext {
    pub relay_url: String,
    pub request_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelayHostAction {
    OpenSocket {
        owner: RelayHostOwner,
        relay_url: String,
    },
    CloseSocket {
        owner: RelayHostOwner,
    },
    SendFrame {
        owner: RelayHostOwner,
        frame: String,
    },
    DecodeInboundFrame {
        owner: RelayHostOwner,
        frame: String,
    },
    DeliverRelayEvent {
        owner: RelayHostOwner,
        subscription_id: String,
        event_id: String,
    },
    ScheduleTimer {
        owner: RelayHostOwner,
        kind: RelayTimerKind,
        delay_ms: u32,
    },
    ClearTimer {
        owner: RelayHostOwner,
        kind: RelayTimerKind,
    },
    FetchNip11 {
        owner: RelayHostOwner,
        relay_url: String,
        request_key: String,
    },
    EmitDiagnostic {
        owner: RelayHostOwner,
        kind: RelayClientDiagnosticKind,
        detail: String,
    },
    PublishSnapshot {
        owner: RelayHostOwner,
    },
    DropCallbackOwner {
        owner: RelayHostOwner,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RelayHostEvent {
    SocketOpened,
    SocketMessage(RelaySocketMessage),
    SocketError(RelaySocketEvent),
    SocketClosed(RelaySocketEvent),
    TimerElapsed { kind: RelayTimerKind },
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct RelayHostEventOutcome {
    pub reducer_event: Option<RelayClientEvent>,
    pub actions: Vec<RelayHostAction>,
}

pub(super) fn action_for_effect(
    owner: &RelayHostOwner,
    context: &RelayHostEffectContext,
    effect: &RelayClientEffect,
) -> RelayHostAction {
    match effect {
        RelayClientEffect::OpenSocket => RelayHostAction::OpenSocket {
            owner: owner.clone(),
            relay_url: context.relay_url.clone(),
        },
        RelayClientEffect::CloseSocket => RelayHostAction::CloseSocket {
            owner: owner.clone(),
        },
        RelayClientEffect::SendFrame(frame) => RelayHostAction::SendFrame {
            owner: owner.clone(),
            frame: frame.clone(),
        },
        RelayClientEffect::InboundFrame(frame) => RelayHostAction::DecodeInboundFrame {
            owner: owner.clone(),
            frame: frame.clone(),
        },
        RelayClientEffect::RelayEvent {
            subscription_id,
            event_id,
        } => RelayHostAction::DeliverRelayEvent {
            owner: owner.clone(),
            subscription_id: subscription_id.clone(),
            event_id: event_id.clone(),
        },
        RelayClientEffect::ScheduleTimer { kind, delay_ms } => RelayHostAction::ScheduleTimer {
            owner: owner.clone(),
            kind: *kind,
            delay_ms: *delay_ms,
        },
        RelayClientEffect::ClearTimer { kind } => RelayHostAction::ClearTimer {
            owner: owner.clone(),
            kind: *kind,
        },
        RelayClientEffect::FetchNip11 => RelayHostAction::FetchNip11 {
            owner: owner.clone(),
            relay_url: context.relay_url.clone(),
            request_key: context.request_key.clone(),
        },
        RelayClientEffect::RecordDiagnostic { kind, detail } => RelayHostAction::EmitDiagnostic {
            owner: owner.clone(),
            kind: *kind,
            detail: detail.clone(),
        },
        RelayClientEffect::PublishSnapshot => RelayHostAction::PublishSnapshot {
            owner: owner.clone(),
        },
        RelayClientEffect::DropCallbackOwner => RelayHostAction::DropCallbackOwner {
            owner: owner.clone(),
        },
    }
}

pub(super) fn reducer_event(event: RelayClientEvent) -> RelayHostEventOutcome {
    RelayHostEventOutcome {
        reducer_event: Some(event),
        actions: Vec::new(),
    }
}

pub(super) fn diagnostic(
    owner: &RelayHostOwner,
    kind: RelayClientDiagnosticKind,
    detail: impl Into<String>,
) -> RelayHostEventOutcome {
    RelayHostEventOutcome {
        reducer_event: None,
        actions: vec![RelayHostAction::EmitDiagnostic {
            owner: owner.clone(),
            kind,
            detail: detail.into(),
        }],
    }
}
