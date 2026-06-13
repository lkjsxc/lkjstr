use std::rc::Rc;

use lkjstr_protocol::{ClientMessage, NostrEvent, RelayMessage, encode_client_message};
use lkjstr_relays::request_timeout_ms;

use crate::{
    relay_host::{BrowserTimeout, RelaySocketCallbacks, RelaySocketHandle, RelaySocketMessage},
    user_timeline_host_view::relay_failure_view,
    user_timeline_relay::UserTimelineRelayRead,
    user_timeline_relay_input::{user_timeline_event_matches_read, user_timeline_relay_filters},
    user_timeline_relay_outcome::UserTimelineRelayOutcome,
    user_timeline_relay_store::publish_stored_event,
};

const FOLLOW_LIST_EVENT_LIMIT: usize = 1;

pub(super) fn install_timeout(read: Rc<UserTimelineRelayRead>) {
    let timer = BrowserTimeout::schedule(request_timeout_ms() as u32, {
        let read = read.clone();
        move || read.timeout()
    });
    if let Ok(timer) = timer {
        read.timeout.borrow_mut().replace(timer);
    }
}

pub(super) fn connect_socket(read: Rc<UserTimelineRelayRead>, relay: String) {
    let callbacks = RelaySocketCallbacks::new(
        {
            let read = read.clone();
            let relay = relay.clone();
            move || read.opened(&relay)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |message| read.message(&relay, message)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |_event| read.finish_relay(&relay, UserTimelineRelayOutcome::Failed)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |_event| read.finish_relay(&relay, UserTimelineRelayOutcome::Failed)
        },
    );
    match RelaySocketHandle::connect(&relay, callbacks) {
        Ok(handle) => {
            read.sockets.borrow_mut().insert(relay, handle);
        }
        Err(_problem) => read.finish_relay(&relay, UserTimelineRelayOutcome::Failed),
    }
}

impl UserTimelineRelayRead {
    pub(super) fn opened(&self, relay: &str) {
        if self.stopped.get() || self.cancelled.get() {
            return;
        }
        let filters = user_timeline_relay_filters(&self.input, relay);
        if filters.is_empty() {
            self.finish_relay(relay, UserTimelineRelayOutcome::Failed);
            return;
        }
        if let Ok(frame) = encode_client_message(&ClientMessage::Req {
            subscription_id: self.sub_id.clone(),
            filters,
        }) && self
            .sockets
            .borrow()
            .get(relay)
            .is_some_and(|handle| handle.send_text(&frame).is_ok())
        {
            return;
        }
        self.finish_relay(relay, UserTimelineRelayOutcome::Failed);
    }

    pub(super) fn message(self: &Rc<Self>, relay: &str, message: RelaySocketMessage) {
        match message {
            RelaySocketMessage::Relay(RelayMessage::Event {
                subscription_id,
                event,
            }) if subscription_id == self.sub_id => self.event(relay, event),
            RelaySocketMessage::Relay(
                RelayMessage::Eose(subscription_id),
            ) if subscription_id == self.sub_id => {
                self.finish_relay(relay, UserTimelineRelayOutcome::NoEvent);
            }
            RelaySocketMessage::Relay(RelayMessage::Closed {
                subscription_id,
                message,
            }) if subscription_id == self.sub_id => {
                self.finish_relay(relay, UserTimelineRelayOutcome::from_closed_message(&message));
            }
            RelaySocketMessage::Relay(RelayMessage::Auth(_)) => {
                self.finish_relay(relay, UserTimelineRelayOutcome::AuthRequired);
            }
            RelaySocketMessage::ParseError { .. } => {
                self.finish_relay(relay, UserTimelineRelayOutcome::Failed);
            }
            _ => {}
        }
    }

    fn event(self: &Rc<Self>, relay: &str, event: NostrEvent) {
        if self.stopped.get() || self.cancelled.get() {
            return;
        }
        if !user_timeline_event_matches_read(&self.input, &event) {
            return;
        }
        let next_count = self.events_seen.get().saturating_add(1);
        self.events_seen.set(next_count);
        self.relay_done.borrow_mut().insert(relay.to_owned());
        self.relay_outcomes
            .borrow_mut()
            .insert(relay.to_owned(), UserTimelineRelayOutcome::Succeeded);
        let outcomes = self.relay_outcomes.borrow().clone();
        publish_stored_event(self.clone(), relay.to_owned(), event, outcomes);
        if next_count >= FOLLOW_LIST_EVENT_LIMIT {
            self.finish_all();
        }
    }

    pub(super) fn timeout(&self) {
        let done = self.relay_done.borrow();
        let mut outcomes = self.relay_outcomes.borrow_mut();
        for relay in &self.input.relays {
            if !done.contains(relay) {
                outcomes.insert(relay.clone(), UserTimelineRelayOutcome::TimedOut);
            }
        }
        drop(outcomes);
        drop(done);
        self.finish_all();
    }

    pub(super) fn cancel(&self) {
        self.cancelled.set(true);
        if !self.stopped.replace(true) {
            self.close_all();
        }
    }

    pub(super) fn finish_relay(&self, relay: &str, outcome: UserTimelineRelayOutcome) {
        if self.stopped.get() || self.cancelled.get() {
            return;
        }
        if !self.relay_done.borrow_mut().insert(relay.to_owned()) {
            return;
        }
        self.relay_outcomes
            .borrow_mut()
            .insert(relay.to_owned(), outcome);
        if self.relay_done.borrow().len() >= self.input.relays.len() {
            self.finish_all();
        }
    }

    fn finish_all(&self) {
        if self.stopped.replace(true) {
            return;
        }
        self.close_all();
        if self.events_seen.get() == 0 && !self.cancelled.get() {
            (self.complete)(relay_failure_view(
                &self.input.owner,
                Some(self.input.target_pubkey.clone()),
                self.input.selected_relays.clone(),
                self.input.author_routes.clone(),
                self.relay_outcomes.borrow().clone(),
            ));
        }
    }

    fn close_all(&self) {
        if let Some(timer) = self.timeout.borrow_mut().take() {
            timer.clear();
        }
        let close = encode_client_message(&ClientMessage::Close(self.sub_id.clone())).ok();
        for (_relay, mut socket) in std::mem::take(&mut *self.sockets.borrow_mut()) {
            if let Some(frame) = &close {
                let _result = socket.send_text(frame);
            }
            let _result = socket.close();
        }
    }
}
