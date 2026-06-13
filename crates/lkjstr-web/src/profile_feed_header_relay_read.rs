use std::rc::Rc;

use lkjstr_protocol::{ClientMessage, NostrEvent, RelayMessage, encode_client_message};
use lkjstr_relays::request_timeout_ms;
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};

use crate::{
    host_status::browser_now_ms,
    profile_feed_header::profile_header_state,
    profile_feed_header_relay::ProfileHeaderRelayRead,
    profile_feed_header_relay_input::{
        profile_header_event_matches_read, profile_header_model, profile_header_relay_filters,
    },
    profile_feed_host::ProfileFeedHost,
    profile_feed_status::{diagnostic, storage_problem},
    relay_host::{BrowserTimeout, RelaySocketCallbacks, RelaySocketHandle, RelaySocketMessage},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_event_put,
};

const HEADER_EVENT_LIMIT: usize = 12;

pub(super) fn install_timeout(read: Rc<ProfileHeaderRelayRead>) {
    let timer = BrowserTimeout::schedule(request_timeout_ms() as u32, {
        let read = read.clone();
        move || read.timeout()
    });
    if let Ok(timer) = timer {
        read.timeout.borrow_mut().replace(timer);
    }
}

pub(super) fn connect_socket(read: Rc<ProfileHeaderRelayRead>, relay: String) {
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
            move |_event| read.finish_relay(&relay)
        },
        {
            let read = read.clone();
            let relay = relay.clone();
            move |_event| read.finish_relay(&relay)
        },
    );
    match RelaySocketHandle::connect(&relay, callbacks) {
        Ok(handle) => {
            read.sockets.borrow_mut().insert(relay, handle);
        }
        Err(_problem) => read.finish_relay(&relay),
    }
}

impl ProfileHeaderRelayRead {
    pub(super) fn opened(&self, relay: &str) {
        if self.stopped.get() || self.cancelled.get() {
            return;
        }
        let filters = profile_header_relay_filters(&self.input, relay);
        if filters.is_empty() {
            self.finish_relay(relay);
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
        self.finish_relay(relay);
    }

    pub(super) fn message(self: &Rc<Self>, relay: &str, message: RelaySocketMessage) {
        match message {
            RelaySocketMessage::Relay(RelayMessage::Event {
                subscription_id,
                event,
            }) if subscription_id == self.sub_id => self.event(relay, event),
            RelaySocketMessage::Relay(
                RelayMessage::Eose(subscription_id) | RelayMessage::Closed { subscription_id, .. },
            ) if subscription_id == self.sub_id => self.finish_relay(relay),
            RelaySocketMessage::Relay(RelayMessage::Auth(_))
            | RelaySocketMessage::ParseError { .. } => self.finish_relay(relay),
            _ => {}
        }
    }

    fn event(self: &Rc<Self>, relay: &str, event: NostrEvent) {
        if self.stopped.get() || self.cancelled.get() {
            return;
        }
        if !profile_header_event_matches_read(&self.input, &event) {
            return;
        }
        let next_count = self.events_seen.get().saturating_add(1);
        self.events_seen.set(next_count);
        publish_stored_event(self.clone(), relay.to_owned(), event);
        if next_count >= HEADER_EVENT_LIMIT {
            self.finish_all();
        }
    }

    pub(super) fn timeout(&self) {
        if self.stopped.replace(true) {
            return;
        }
        self.close_all();
    }

    pub(super) fn cancel(&self) {
        self.cancelled.set(true);
        if !self.stopped.replace(true) {
            self.close_all();
        }
    }

    pub(super) fn finish_relay(&self, relay: &str) {
        if self.stopped.get() || self.cancelled.get() {
            return;
        }
        self.relay_done.borrow_mut().insert(relay.to_owned());
        if self.relay_done.borrow().len() >= self.input.relays.len() {
            self.finish_all();
        }
    }

    fn finish_all(&self) {
        if self.stopped.replace(true) {
            return;
        }
        self.close_all();
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

fn publish_stored_event(read: Rc<ProfileHeaderRelayRead>, relay: String, event: NostrEvent) {
    wasm_bindgen_futures::spawn_local(async move {
        let outcome = store_profile_header_event(&read.host, &relay, event).await;
        if read.cancelled.get() {
            return;
        }
        let mut diagnostics = read.input.diagnostics.clone();
        if !outcome.is_ok() {
            let reason = storage_problem("Relay Profile header event unavailable", outcome);
            diagnostics.push(diagnostic("profile-header-relay-store", &reason));
        }
        let header = profile_header_state(&read.host, &read.input.profile_pubkey, &mut diagnostics)
            .await;
        if !read.cancelled.get() {
            (read.complete)(profile_header_model(&read.input, header, diagnostics));
        }
    });
}

pub(crate) async fn store_profile_header_event(
    host: &ProfileFeedHost,
    relay_url: &str,
    event: NostrEvent,
) -> StorageOutcome<()> {
    let now_ms = browser_now_ms();
    let relay = sqlite_event_relay_row(&event.id, relay_url, now_ms, "profile-header-relay");
    let row = StoredEventRecord {
        event,
        received_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_event_put(&store, &row, &[relay]).await
    })
    .await
}
