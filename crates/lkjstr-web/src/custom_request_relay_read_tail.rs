use std::rc::Rc;

use lkjstr_protocol::{ClientMessage, encode_client_message};
use lkjstr_relays::{ProgressiveReadEvidence, progressive_read_snapshot, reduce_progressive_read};

use crate::{
    custom_request_geometry::custom_request_geometry_models,
    custom_request_relay_model::{output_from_snapshot_with_geometry, window_from_snapshot},
    custom_request_relay_read::CustomRequestRelayRead,
    home_feed_relay_status::{RelayEnd, relay_status, relay_terminal},
    host_status::browser_now_ms,
    relay_host::{RelaySocketCallbacks, RelaySocketHandle},
};

pub(super) fn connect_socket(read: Rc<CustomRequestRelayRead>, relay: String) {
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

impl CustomRequestRelayRead {
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
        let input = self.input.clone();
        let complete = self.complete.clone();
        let generation = self.publish_generation.get().saturating_add(1);
        self.publish_generation.set(generation);
        let latest = self.publish_generation.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let window = window_from_snapshot(&input, &snapshot);
            let geometry_models = custom_request_geometry_models(
                &input.db_name,
                &input.worker_url,
                &window,
                680,
                1.0,
            )
            .await;
            if latest.get() == generation {
                complete(output_from_snapshot_with_geometry(
                    &input,
                    snapshot,
                    geometry_models,
                ));
            }
        });
    }

    pub(super) fn close_all(&self) {
        if let Some(timer) = self.timeout.borrow_mut().take() {
            timer.clear();
        }
        let close = encode_client_message(&ClientMessage::Close(self.sub_id.clone())).ok();
        let sockets = std::mem::take(&mut *self.sockets.borrow_mut());
        for (_relay, mut socket) in sockets {
            if socket.can_wire_close()
                && let Some(frame) = &close
            {
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
