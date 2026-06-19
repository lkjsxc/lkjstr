use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use std::rc::Rc;

use lkjstr_protocol::{ClientMessage, RelayMessage, encode_client_message};
use lkjstr_relays::{
    InitialProgressiveRead, PageReadSurface, ProgressiveEvent, ProgressiveReadEvidence,
    ProgressiveReadState, initial_progressive_read, request_timeout_ms,
};

use crate::{
    custom_request_relay_input::{CustomRequestRelayReadInput, custom_request_event_matches_read},
    custom_request_relay_model::CustomRequestRelayReadOutput,
    custom_request_relay_read_tail::connect_socket,
    home_feed_relay_status::{RelayEnd, relay_status},
    host_status::browser_now_ms,
    relay_host::{BrowserTimeout, RelaySocketHandle, RelaySocketMessage},
    relay_read_handle::RelayReadHandle,
};

const WINDOW_MAX: usize = 180;

pub(crate) fn start_custom_request_relay_read(
    input: CustomRequestRelayReadInput,
    complete: impl Fn(CustomRequestRelayReadOutput) + 'static,
) -> RelayReadHandle {
    let sub_id = input.sub_id.clone();
    let relays = input.relays.clone();
    let read = Rc::new(CustomRequestRelayRead {
        sub_id: sub_id.clone(),
        relays: relays.clone(),
        input,
        state: RefCell::new(initial_progressive_read(InitialProgressiveRead {
            read_id: sub_id,
            surface: Some(PageReadSurface::CustomRequest),
            relays,
            started_at_ms: browser_now_ms(),
        })),
        sockets: RefCell::new(BTreeMap::new()),
        timeout: RefCell::new(None),
        done: Cell::new(false),
        publish_generation: Rc::new(Cell::new(0)),
        complete: Rc::new(complete),
    });
    let handle = RelayReadHandle::from_rc(&read, CustomRequestRelayRead::cancel);
    install_timeout(read.clone());
    for relay in read.relays.clone() {
        connect_socket(read.clone(), relay);
    }
    handle
}

pub(super) struct CustomRequestRelayRead {
    pub(super) input: CustomRequestRelayReadInput,
    pub(super) sub_id: String,
    pub(super) relays: Vec<String>,
    pub(super) state: RefCell<ProgressiveReadState>,
    pub(super) sockets: RefCell<BTreeMap<String, RelaySocketHandle>>,
    pub(super) timeout: RefCell<Option<BrowserTimeout>>,
    pub(super) done: Cell<bool>,
    pub(super) publish_generation: Rc<Cell<u64>>,
    pub(super) complete: Rc<dyn Fn(CustomRequestRelayReadOutput)>,
}

fn install_timeout(read: Rc<CustomRequestRelayRead>) {
    let Ok(timer) = BrowserTimeout::schedule(request_timeout_ms() as u32, {
        let read = read.clone();
        move || read.timeout()
    }) else {
        return;
    };
    read.timeout.borrow_mut().replace(timer);
}

impl CustomRequestRelayRead {
    pub(super) fn opened(&self, relay: &str) {
        if self.done.get() {
            return;
        }
        self.apply_status(relay, RelayEnd::Connected);
        let frame = ClientMessage::Req {
            subscription_id: self.sub_id.clone(),
            filters: self.input.filters_for_relay(relay),
        };
        if let Ok(frame) = encode_client_message(&frame)
            && self
                .sockets
                .borrow()
                .get(relay)
                .is_some_and(|handle| handle.send_text(&frame).is_ok())
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
        if self.done.get() || !custom_request_event_matches_read(&self.input, &event) {
            return;
        }
        self.reduce(ProgressiveReadEvidence::RelayEvents(vec![ProgressiveEvent {
            relays: vec![relay.to_owned()],
            sub_id: self.sub_id.clone(),
            event,
        }]));
        self.apply_status(relay, RelayEnd::Reading);
        if self.state.borrow().events.len() >= WINDOW_MAX {
            self.finish_all("relay-event-limit", RelayEnd::EventLimit);
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
        self.publish_generation
            .set(self.publish_generation.get().saturating_add(1));
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

    fn finish_all(&self, reason: &str, end: RelayEnd) {
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
        self.publish(reason);
        self.close_all();
    }
}
