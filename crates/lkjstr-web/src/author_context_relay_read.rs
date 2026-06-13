use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use std::rc::Rc;

use lkjstr_app::AuthorContextFeedView;
use lkjstr_protocol::{ClientMessage, RelayMessage, encode_client_message};
use lkjstr_relays::{
    InitialProgressiveRead, PageReadSurface, ProgressiveEvent, ProgressiveReadEvidence,
    ProgressiveReadState, initial_progressive_read, request_timeout_ms,
};

use crate::{
    author_context_host::WINDOW_MAX,
    author_context_relay_input::{AuthorContextRelayReadInput, author_context_event_matches_read},
    author_context_relay_read_tail::connect_socket,
    home_feed_relay_status::{RelayEnd, relay_status},
    host_status::browser_now_ms,
    relay_host::{BrowserTimeout, RelaySocketHandle, RelaySocketMessage},
    relay_read_handle::RelayReadHandle,
};

pub(crate) fn start_read(
    input: AuthorContextRelayReadInput,
    sub_id: String,
    filters: Vec<lkjstr_protocol::NostrFilter>,
    relays: Vec<String>,
    complete: impl Fn(AuthorContextFeedView) + 'static,
) -> RelayReadHandle {
    let read = Rc::new(AuthorContextRelayRead {
        input,
        sub_id: sub_id.clone(),
        filters,
        state: RefCell::new(initial_progressive_read(InitialProgressiveRead {
            read_id: sub_id,
            surface: Some(PageReadSurface::AuthorContext),
            relays: relays.clone(),
            started_at_ms: browser_now_ms(),
        })),
        sockets: RefCell::new(BTreeMap::new()),
        timeout: RefCell::new(None),
        done: Cell::new(false),
        complete: Box::new(complete),
    });
    let handle = RelayReadHandle::from_rc(&read, AuthorContextRelayRead::cancel);
    install_timeout(read.clone());
    for relay in relays {
        connect_socket(read.clone(), relay);
    }
    handle
}

pub(super) struct AuthorContextRelayRead {
    pub(super) input: AuthorContextRelayReadInput,
    pub(super) sub_id: String,
    pub(super) filters: Vec<lkjstr_protocol::NostrFilter>,
    pub(super) state: RefCell<ProgressiveReadState>,
    pub(super) sockets: RefCell<BTreeMap<String, RelaySocketHandle>>,
    pub(super) timeout: RefCell<Option<BrowserTimeout>>,
    pub(super) done: Cell<bool>,
    pub(super) complete: Box<dyn Fn(AuthorContextFeedView)>,
}

fn install_timeout(read: Rc<AuthorContextRelayRead>) {
    let timer = BrowserTimeout::schedule(request_timeout_ms() as u32, {
        let read = read.clone();
        move || read.timeout()
    });
    if let Ok(timer) = timer {
        read.timeout.borrow_mut().replace(timer);
    }
}

impl AuthorContextRelayRead {
    pub(super) fn opened(&self, relay: &str) {
        if self.done.get() {
            return;
        }
        self.apply_status(relay, RelayEnd::Connected);
        if let Ok(frame) = encode_client_message(&ClientMessage::Req {
            subscription_id: self.sub_id.clone(),
            filters: self.filters.clone(),
        }) && self
            .sockets
            .borrow()
            .get(relay)
            .is_some_and(|socket| socket.send_text(&frame).is_ok())
        {
            return;
        }
        self.finish_relay(relay, RelayEnd::Error);
    }

    pub(super) fn message(&self, relay: &str, message: RelaySocketMessage) {
        match message {
            RelaySocketMessage::Relay(RelayMessage::Event {
                subscription_id,
                event,
            }) if subscription_id == self.sub_id => self.event(relay, event),
            RelaySocketMessage::Relay(RelayMessage::Eose(subscription_id))
                if subscription_id == self.sub_id =>
            {
                self.finish_relay(relay, RelayEnd::Eose)
            }
            RelaySocketMessage::Relay(RelayMessage::Closed {
                subscription_id, ..
            }) if subscription_id == self.sub_id => self.finish_relay(relay, RelayEnd::Closed),
            RelaySocketMessage::Relay(RelayMessage::Auth(_)) => {
                self.finish_relay(relay, RelayEnd::Auth);
            }
            RelaySocketMessage::ParseError { .. } => self.finish_relay(relay, RelayEnd::Error),
            _ => {}
        }
    }

    fn event(&self, relay: &str, event: lkjstr_protocol::NostrEvent) {
        if self.done.get() || !author_context_event_matches_read(&self.input, &event) {
            return;
        }
        self.reduce(ProgressiveReadEvidence::RelayEvents(vec![
            ProgressiveEvent {
                relays: vec![relay.to_owned()],
                sub_id: self.sub_id.clone(),
                event,
            },
        ]));
        self.apply_status(relay, RelayEnd::Reading);
        if self.state.borrow().events.len() >= WINDOW_MAX {
            self.finish_all(RelayEnd::EventLimit);
            return;
        }
        self.publish("relay-event");
    }

    fn timeout(&self) {
        if self.done.replace(true) {
            return;
        }
        self.reduce(ProgressiveReadEvidence::Timeout);
        self.publish("relay-timeout");
        self.close_all();
    }

    pub(super) fn cancel(&self) {
        if self.done.replace(true) {
            return;
        }
        self.reduce(ProgressiveReadEvidence::Cancel);
        self.close_all();
    }

    pub(super) fn finish_relay(&self, relay: &str, end: RelayEnd) {
        if self.done.get() || self.relay_done(relay) {
            return;
        }
        self.apply_status(relay, end);
        if self.all_relays_done() {
            self.done.set(true);
            self.reduce(ProgressiveReadEvidence::Finalize(Vec::new()));
            self.publish("relay-final");
            self.close_all();
        }
    }

    fn finish_all(&self, end: RelayEnd) {
        if self.done.replace(true) {
            return;
        }
        let statuses = self
            .state
            .borrow()
            .relays
            .iter()
            .map(|relay| relay_status(relay, end, self.relay_event_count(relay)))
            .collect();
        self.reduce(ProgressiveReadEvidence::Finalize(statuses));
        self.publish("relay-event-limit");
        self.close_all();
    }
}
