use std::collections::BTreeMap;

use lkjstr_relays::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayClientEvent, RelayTimerKind,
};

use crate::relay_host::{
    RelayHostEffectContext, RelayHostEvent, RelayHostEventOutcome, RelayHostOwner,
    RelaySocketMessage,
    effect_action::{action_for_effect, diagnostic, reducer_event},
};

#[derive(Default)]
pub struct RelayEffectRunner {
    owners: BTreeMap<String, OwnerSlot>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct OwnerSlot {
    generation: u64,
    context: RelayHostEffectContext,
    closed: bool,
}

impl RelayEffectRunner {
    #[must_use]
    pub fn register_owner(
        &mut self,
        owner_id: impl Into<String>,
        relay_url: impl Into<String>,
        request_key: impl Into<String>,
    ) -> RelayHostOwner {
        let id = owner_id.into();
        let generation = self
            .owners
            .get(&id)
            .map_or(1, |slot| slot.generation.saturating_add(1));
        self.owners.insert(
            id.clone(),
            OwnerSlot {
                generation,
                context: RelayHostEffectContext {
                    relay_url: relay_url.into(),
                    request_key: request_key.into(),
                },
                closed: false,
            },
        );
        RelayHostOwner { id, generation }
    }

    #[must_use]
    pub fn apply_effect(
        &mut self,
        owner: &RelayHostOwner,
        effect: RelayClientEffect,
    ) -> Vec<crate::relay_host::RelayHostAction> {
        self.apply_effects(owner, std::slice::from_ref(&effect))
    }

    #[must_use]
    pub fn apply_effects(
        &mut self,
        owner: &RelayHostOwner,
        effects: &[RelayClientEffect],
    ) -> Vec<crate::relay_host::RelayHostAction> {
        let Some(slot) = self.active_slot(owner) else {
            return Vec::new();
        };
        let context = slot.context.clone();
        let mut drop_owner = false;
        let actions = effects
            .iter()
            .map(|effect| {
                drop_owner |= matches!(effect, RelayClientEffect::DropCallbackOwner);
                action_for_effect(owner, &context, effect)
            })
            .collect();
        if drop_owner {
            self.close_owner(owner);
        }
        actions
    }

    #[must_use]
    pub fn map_host_event(
        &self,
        owner: &RelayHostOwner,
        event: RelayHostEvent,
    ) -> RelayHostEventOutcome {
        if self.active_slot(owner).is_none() {
            return self.ignored_after_close(owner, "host-event");
        }
        match event {
            RelayHostEvent::SocketOpened => reducer_event(RelayClientEvent::SocketOpened),
            RelayHostEvent::SocketMessage(RelaySocketMessage::Relay(message)) => {
                reducer_event(RelayClientEvent::RelayMessage { message })
            }
            RelayHostEvent::SocketMessage(RelaySocketMessage::ParseError { code, message }) => {
                diagnostic(
                    owner,
                    RelayClientDiagnosticKind::MalformedMessage,
                    format!("{code:?}: {message}"),
                )
            }
            RelayHostEvent::SocketError(event) => reducer_event(RelayClientEvent::SocketError {
                reason: event.reason,
            }),
            RelayHostEvent::SocketClosed(event) => reducer_event(RelayClientEvent::SocketClosed {
                reason: event.reason,
            }),
            RelayHostEvent::TimerElapsed {
                kind: RelayTimerKind::ConnectDeadline,
            } => reducer_event(RelayClientEvent::ConnectDeadlineElapsed),
            RelayHostEvent::TimerElapsed {
                kind: RelayTimerKind::Reconnect,
            } => reducer_event(RelayClientEvent::ReconnectTimerElapsed),
            RelayHostEvent::TimerElapsed { .. } => RelayHostEventOutcome::default(),
        }
    }

    fn active_slot(&self, owner: &RelayHostOwner) -> Option<&OwnerSlot> {
        self.matching_slot(owner).filter(|slot| !slot.closed)
    }

    fn matching_slot(&self, owner: &RelayHostOwner) -> Option<&OwnerSlot> {
        self.owners
            .get(&owner.id)
            .filter(|slot| slot.generation == owner.generation)
    }

    fn close_owner(&mut self, owner: &RelayHostOwner) {
        if let Some(slot) = self.owners.get_mut(&owner.id)
            && slot.generation == owner.generation
        {
            slot.closed = true;
        }
    }

    fn ignored_after_close(
        &self,
        owner: &RelayHostOwner,
        detail: &'static str,
    ) -> RelayHostEventOutcome {
        if self.matching_slot(owner).is_none() {
            return RelayHostEventOutcome::default();
        }
        diagnostic(owner, RelayClientDiagnosticKind::IgnoredAfterClose, detail)
    }
}
