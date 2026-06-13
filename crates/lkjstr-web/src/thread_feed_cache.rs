use std::collections::BTreeMap;

use lkjstr_app::{
    FeedWindowEvidence, FeedWindowFlags, ThreadFeedDiagnosticInput, ThreadFeedSourceState,
    empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, reply_root};
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::{
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{
        sqlite_event_get, sqlite_event_relays, sqlite_events_by_tag_value, SqliteStore,
    },
    thread_feed_cache_parents::hydrate_parent_chain,
    thread_feed_host::{ThreadFeedHost, WINDOW_MAX},
    thread_feed_status::{diagnostic, storage_problem},
};

pub(crate) struct ThreadCacheState {
    pub(crate) window: lkjstr_app::FeedWindowState,
    pub(crate) source_state: ThreadFeedSourceState,
    pub(crate) root_event_id: Option<String>,
    pub(crate) root_author: Option<String>,
}

pub(crate) async fn thread_cache_state(
    host: &ThreadFeedHost,
    event_id: &str,
    diagnostics: &mut Vec<ThreadFeedDiagnosticInput>,
) -> ThreadCacheState {
    match cached_thread(host, event_id).await {
        StorageOutcome::Ok(cached) => ThreadCacheState {
            window: window_from_events(cached.events),
            source_state: ThreadFeedSourceState::Partial {
                reason: cached.partial_reason,
                retry_available: true,
            },
            root_event_id: Some(cached.root_event_id),
            root_author: cached.root_author,
        },
        outcome => {
            diagnostics.push(diagnostic(
                "cache-events",
                &storage_problem("Cached Thread events unavailable", outcome),
            ));
            ThreadCacheState {
                window: empty_feed_window(1, WINDOW_MAX),
                source_state: ThreadFeedSourceState::Partial {
                    reason: "Cached Thread rows are unavailable.".to_owned(),
                    retry_available: true,
                },
                root_event_id: Some(event_id.to_owned()),
                root_author: None,
            }
        }
    }
}

struct CachedThread {
    root_event_id: String,
    root_author: Option<String>,
    events: Vec<ProgressiveEvent>,
    partial_reason: String,
}

async fn cached_thread(host: &ThreadFeedHost, event_id: &str) -> StorageOutcome<CachedThread> {
    let event_id = event_id.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let focused = match sqlite_event_get(&store, &event_id).await {
            StorageOutcome::Ok(row) => row,
            outcome => return outcome.map(|_| unreachable_cached()),
        };
        let root_event_id = focused
            .as_ref()
            .and_then(|row| reply_root(&row.event))
            .unwrap_or_else(|| event_id.clone());
        let mut by_id = BTreeMap::<String, StoredEventRecord>::new();
        if let Some(row) = focused {
            by_id.insert(row.event.id.clone(), row);
        }
        if let StorageOutcome::Ok(Some(root)) = sqlite_event_get(&store, &root_event_id).await {
            by_id.insert(root.event.id.clone(), root);
        }
        let replies = match cached_replies(&store, &root_event_id, &event_id).await {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| unreachable_cached()),
        };
        for row in replies {
            if is_thread_display_event(&row.event, &root_event_id, &event_id) {
                by_id.entry(row.event.id.clone()).or_insert(row);
            }
        }
        let parents = match hydrate_parent_chain(&store, &mut by_id, &root_event_id).await {
            StorageOutcome::Ok(parents) => parents,
            outcome => return outcome.map(|_| unreachable_cached()),
        };
        let root_author = by_id.get(&root_event_id).map(|row| row.event.pubkey.clone());
        events_with_relays(&store, by_id).await.map(|events| CachedThread {
            root_event_id,
            root_author,
            partial_reason: partial_reason(events.is_empty(), parents.missing_count),
            events,
        })
    })
    .await
}

async fn cached_replies(
    store: &SqliteStore,
    root_event_id: &str,
    focus_event_id: &str,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    let mut out = Vec::new();
    for target in reply_targets(root_event_id, focus_event_id) {
        let rows = match sqlite_events_by_tag_value(store, "e", target, 30).await {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| Vec::new()),
        };
        out.extend(rows);
    }
    StorageOutcome::Ok(out)
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
            sub_id: "thread-cache".to_owned(),
            event: row.event,
        });
    }
    StorageOutcome::Ok(out)
}

fn partial_reason(empty: bool, missing_parent_count: usize) -> String {
    if empty {
        return "No cached Thread rows were found; relay Thread bootstrap is starting."
            .to_owned();
    }
    if missing_parent_count > 0 {
        return "Showing cached Thread rows while relay Thread bootstrap reads run and parent-chain hydration continues.".to_owned();
    }
    "Showing cached Thread rows while relay Thread bootstrap reads run.".to_owned()
}

fn window_from_events(events: Vec<ProgressiveEvent>) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, WINDOW_MAX),
        FeedWindowEvidence::Events {
            generation: 1,
            events,
            flags: FeedWindowFlags::default(),
        },
    )
}

const fn is_thread_display_kind(kind: u64) -> bool {
    matches!(kind, KIND_TEXT_NOTE | KIND_REPOST | KIND_GENERIC_REPOST)
}

fn is_thread_display_event(event: &lkjstr_protocol::NostrEvent, root: &str, focus: &str) -> bool {
    is_thread_display_kind(event.kind)
        && reply_root(event)
            .is_some_and(|target| target == root || target == focus)
}

fn reply_targets<'a>(root: &'a str, focus: &'a str) -> Vec<&'a str> {
    if root == focus {
        return vec![root];
    }
    vec![root, focus]
}

fn unreachable_cached() -> CachedThread {
    CachedThread {
        root_event_id: String::new(),
        root_author: None,
        events: Vec::new(),
        partial_reason: String::new(),
    }
}
