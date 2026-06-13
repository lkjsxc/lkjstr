use std::rc::Rc;

use lkjstr_protocol::{ClientMessage, encode_client_message};
use lkjstr_relays::{ProgressiveReadEvidence, progressive_read_snapshot, reduce_progressive_read};

use crate::{
    home_feed_relay_status::{RelayEnd, relay_status, relay_terminal},
    host_status::browser_now_ms,
    profile_feed_relay_model::model_from_snapshot,
    profile_feed_relay_read::ProfileRelayRead,
    relay_host::{RelaySocketCallbacks, RelaySocketHandle},
};

pub(super) fn connect_socket(read: Rc<ProfileRelayRead>, relay: String) {
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
            move |_event| read.finish_relay(&relay, RelayEnd::Error)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |_event| read.finish_relay(&relay, RelayEnd::Closed)
        },
    );
    match RelaySocketHandle::connect(&relay, callbacks) {
        Ok(handle) => {
            read.sockets.borrow_mut().insert(relay, handle);
        }
        Err(_problem) => read.finish_relay(&relay, RelayEnd::Error),
    }
}

impl ProfileRelayRead {
    pub(super) fn apply_status(&self, relay: &str, end: RelayEnd) {
        let count = self.relay_event_count(relay);
        self.reduce(ProgressiveReadEvidence::RelayStatuses(vec![relay_status(
            relay, end, count,
        )]));
    }

    pub(super) fn reduce(&self, evidence: ProgressiveReadEvidence) {
        let next = reduce_progressive_read(self.state.borrow().clone(), evidence);
        self.state.replace(next);
    }

    pub(super) fn publish(&self, reason: &str) {
        let snapshot = progressive_read_snapshot(&self.state.borrow(), reason, browser_now_ms());
        (self.complete)(model_from_snapshot(&self.input, snapshot));
    }

    pub(super) fn close_all(&self) {
        if let Some(timer) = self.timeout.borrow_mut().take() {
            timer.clear();
        }
        let close = encode_client_message(&ClientMessage::Close(self.sub_id.clone())).ok();
        let sockets = std::mem::take(&mut *self.sockets.borrow_mut());
        for (_relay, mut socket) in sockets {
            if let Some(frame) = &close {
                let _result = socket.send_text(frame);
            }
            let _result = socket.close();
        }
    }

    pub(super) fn relay_event_count(&self, relay: &str) -> u64 {
        self.state
            .borrow()
            .events
            .iter()
            .filter(|event| event.relays.iter().any(|item| item == relay))
            .count() as u64
    }

    pub(super) fn relay_done(&self, relay: &str) -> bool {
        self.state
            .borrow()
            .relay_states
            .get(relay)
            .is_some_and(|snapshot| relay_terminal(snapshot.state))
    }

    pub(super) fn all_relays_done(&self) -> bool {
        self.state
            .borrow()
            .relay_states
            .values()
            .all(|snapshot| relay_terminal(snapshot.state))
    }
}
