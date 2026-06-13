use std::{collections::BTreeMap, rc::Rc};

use lkjstr_protocol::NostrEvent;
use lkjstr_storage::{StorageOutcome, StoredEventRecord, sqlite_event_relay_row};

use crate::{
    host_status::browser_now_ms,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_event_put,
    user_timeline_host::UserTimelineHost,
    user_timeline_host_model::user_timeline_model_with_relay_outcomes,
    user_timeline_relay::UserTimelineRelayRead,
    user_timeline_relay_outcome::UserTimelineRelayOutcome,
};

pub(super) fn publish_stored_event(
    read: Rc<UserTimelineRelayRead>,
    relay: String,
    event: NostrEvent,
    relay_outcomes: BTreeMap<String, UserTimelineRelayOutcome>,
) {
    wasm_bindgen_futures::spawn_local(async move {
        let _outcome = store_user_timeline_relay_event(&read.host, &relay, event).await;
        if read.cancelled.get() {
            return;
        }
        let model = user_timeline_model_with_relay_outcomes(
            &read.host,
            &read.input.owner,
            Some(read.input.target_pubkey.clone()),
            relay_outcomes,
        )
        .await;
        if !read.cancelled.get() {
            (read.complete)(model);
        }
    });
}

pub(crate) async fn store_user_timeline_relay_event(
    host: &UserTimelineHost,
    relay_url: &str,
    event: NostrEvent,
) -> StorageOutcome<()> {
    let now_ms = browser_now_ms();
    let relay = sqlite_event_relay_row(&event.id, relay_url, now_ms, "user-timeline-relay");
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
