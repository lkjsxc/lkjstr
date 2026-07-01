use std::rc::Rc;

use lkjstr_protocol::{ClientMessage, encode_client_message};
use lkjstr_relays::{ProgressiveReadEvidence, progressive_read_snapshot, reduce_progressive_read};

use crate::{
    home_feed_relay_status::{RelayEnd, relay_status, relay_terminal},
    host_status::browser_now_ms,
    relay_host::{RelaySocketCallbacks, RelaySocketHandle},
    thread_feed_relay_model::output_from_snapshot,
    thread_feed_relay_read::ThreadRelayRead,
};

pub(super) fn connect_socket(read: Rc<ThreadRelayRead>, relay: String) {
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

impl ThreadRelayRead {
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
        (self.complete)(output_from_snapshot(&self.input, snapshot));
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        cell::{Cell, RefCell},
        collections::BTreeMap,
    };

    use lkjstr_app::empty_feed_window;
    use lkjstr_relays::{InitialProgressiveRead, PageReadSurface, initial_progressive_read};
    use wasm_bindgen_test::wasm_bindgen_test;

    #[wasm_bindgen_test]
    fn relay_read_handle_cancel_marks_read_done() {
        let complete_called = Rc::new(Cell::new(false));
        let read = Rc::new(ThreadRelayRead {
            input: input(),
            sub_id: "thread".to_owned(),
            filters: Vec::new(),
            state: RefCell::new(initial_progressive_read(InitialProgressiveRead {
                read_id: "thread".to_owned(),
                surface: Some(PageReadSurface::Thread),
                relays: vec!["wss://selected.example".to_owned()],
                started_at_ms: 0,
            })),
            sockets: RefCell::new(BTreeMap::new()),
            timeout: RefCell::new(None),
            done: Cell::new(false),
            complete: Box::new({
                let complete_called = complete_called.clone();
                move |_output| complete_called.set(true)
            }),
        });

        let handle = crate::relay_read_handle::RelayReadHandle::from_rc(
            &read,
            ThreadRelayRead::cancel,
        );
        handle.cancel();

        assert!(read.done.get());
        assert!(!complete_called.get());
    }

    fn input() -> crate::thread_feed_relay_input::ThreadRelayReadInput {
        crate::thread_feed_relay_input::ThreadRelayReadInput {
            owner: "thread-tab".to_owned(),
            event_id: "1".repeat(64),
            root_event_id: "1".repeat(64),
            root_author: None,
            selected_relays: vec!["wss://selected.example".to_owned()],
            author_routes: Vec::new(),
            cache_window: empty_feed_window(1, 240),
            geometry_models: Vec::new(),
            diagnostics: Vec::new(),
            since: 70,
            until: 100,
            phase: crate::thread_feed_relay_input::ThreadRelayReadPhase::Initial,
        }
    }
}
