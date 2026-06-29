use std::collections::BTreeMap;

use lkjstr_app::{FeedWindowEvidence, FeedWindowFlags, empty_feed_window, reduce_feed_window};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::{
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{SqliteStore, sqlite_event_relays, sqlite_events_by_author_kind},
    user_timeline_host::{PAGE_SIZE, UserTimelineHost, WINDOW_MAX},
};

pub(crate) async fn latest_follow_list(
    host: &UserTimelineHost,
    pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    let pubkey = pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_events_by_author_kind(&store, &pubkey, KIND_FOLLOW_LIST, u64::MAX, 1).await {
            StorageOutcome::Ok(mut rows) => StorageOutcome::Ok(rows.pop()),
            outcome => outcome.map(|_| None),
        }
    })
    .await
}

pub(crate) async fn cached_events(
    host: &UserTimelineHost,
    authors: &[String],
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    let authors = authors.to_vec();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let mut by_id = BTreeMap::<String, StoredEventRecord>::new();
        for author in authors.into_iter().take(128) {
            match collect_author_events(&store, &author, &mut by_id).await {
                StorageOutcome::Ok(()) => {}
                outcome => return outcome.map(|_| Vec::new()),
            }
        }
        events_with_relays(&store, by_id).await
    })
    .await
}

pub(crate) fn window_from_events(events: Vec<ProgressiveEvent>) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, WINDOW_MAX),
        FeedWindowEvidence::Events {
            generation: 1,
            events,
            flags: FeedWindowFlags::default(),
        },
    )
}

async fn collect_author_events(
    store: &SqliteStore,
    author: &str,
    by_id: &mut BTreeMap<String, StoredEventRecord>,
) -> StorageOutcome<()> {
    for kind in [KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST] {
        let rows = match sqlite_events_by_author_kind(store, author, kind, u64::MAX, PAGE_SIZE)
            .await
        {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| ()),
        };
        for row in rows {
            by_id.entry(row.event.id.clone()).or_insert(row);
        }
    }
    StorageOutcome::Ok(())
}

async fn events_with_relays(
    store: &SqliteStore,
    rows: BTreeMap<String, StoredEventRecord>,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    let mut out = Vec::with_capacity(rows.len());
    for row in rows.into_values() {
        let relays = match sqlite_event_relays(store, &row.event.id).await {
            StorageOutcome::Ok(rows) => rows.into_iter().map(|item| item.relay_url).collect(),
            outcome => return outcome.map(|_| Vec::new()),
        };
        out.push(ProgressiveEvent {
            relays,
            sub_id: "user-timeline-cache".to_owned(),
            event: row.event,
        });
    }
    StorageOutcome::Ok(out)
}
