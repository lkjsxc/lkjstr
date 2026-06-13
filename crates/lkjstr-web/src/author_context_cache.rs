use std::collections::BTreeMap;

use lkjstr_app::{
    AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState, FeedDiagnosticSeverity,
    FeedWindowEvidence, FeedWindowFlags, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::{
    author_context_host::{AuthorContextHost, PAGE_SIZE, WINDOW_MAX},
    host_status::problem_status,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{
        SqliteStore, sqlite_event_get, sqlite_event_relays, sqlite_events_by_author_kind,
    },
};

pub(crate) struct AuthorContextCacheState {
    pub(crate) window: lkjstr_app::FeedWindowState,
    pub(crate) source_state: AuthorContextFeedSourceState,
    pub(crate) anchor_created_at: Option<u64>,
}

pub(crate) async fn author_context_cache_state(
    host: &AuthorContextHost,
    event_id: &str,
    author_pubkey: &str,
    diagnostics: &mut Vec<AuthorContextFeedDiagnosticInput>,
) -> AuthorContextCacheState {
    match cached_author_context(host, event_id, author_pubkey).await {
        StorageOutcome::Ok(cached) => AuthorContextCacheState {
            window: window_from_events(cached.events),
            source_state: cached.source_state,
            anchor_created_at: cached.anchor_created_at,
        },
        outcome => {
            diagnostics.push(diagnostic(
                "cache-events",
                &problem_status("Cached Author Context rows unavailable", outcome),
            ));
            AuthorContextCacheState {
                window: empty_feed_window(1, WINDOW_MAX),
                source_state: AuthorContextFeedSourceState::Partial {
                    reason: "Cached Author Context rows are unavailable.".to_owned(),
                    retry_available: true,
                },
                anchor_created_at: None,
            }
        }
    }
}

struct CachedAuthorContext {
    events: Vec<ProgressiveEvent>,
    source_state: AuthorContextFeedSourceState,
    anchor_created_at: Option<u64>,
}

async fn cached_author_context(
    host: &AuthorContextHost,
    event_id: &str,
    author_pubkey: &str,
) -> StorageOutcome<CachedAuthorContext> {
    let event_id = event_id.to_owned();
    let author_pubkey = author_pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let anchor = match sqlite_event_get(&store, &event_id).await {
            StorageOutcome::Ok(row) => row,
            outcome => return outcome.map(|_| empty_cached()),
        };
        let Some(anchor) = anchor.filter(|row| row.event.pubkey == author_pubkey) else {
            return StorageOutcome::Ok(CachedAuthorContext {
                events: Vec::new(),
                source_state: AuthorContextFeedSourceState::Pending,
                anchor_created_at: None,
            });
        };
        let created_at = anchor.event.created_at;
        let mut by_id = BTreeMap::<String, StoredEventRecord>::new();
        by_id.insert(anchor.event.id.clone(), anchor);
        match collect_author_events(&store, &author_pubkey, created_at, &mut by_id).await {
            StorageOutcome::Ok(()) => {}
            outcome => return outcome.map(|_| empty_cached()),
        }
        events_with_relays(&store, by_id).await.map(|events| CachedAuthorContext {
            events,
            source_state: AuthorContextFeedSourceState::Partial {
                reason: "Showing cached Author Context rows without complete coverage proof; relay reads remain open.".to_owned(),
                retry_available: true,
            },
            anchor_created_at: Some(created_at),
        })
    })
    .await
}

async fn collect_author_events(
    store: &SqliteStore,
    author_pubkey: &str,
    anchor_created_at: u64,
    by_id: &mut BTreeMap<String, StoredEventRecord>,
) -> StorageOutcome<()> {
    for kind in [KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST] {
        let rows =
            match sqlite_events_by_author_kind(store, author_pubkey, kind, u64::MAX, PAGE_SIZE)
                .await
            {
                StorageOutcome::Ok(rows) => rows,
                outcome => return outcome.map(|_| ()),
            };
        for row in rows
            .into_iter()
            .filter(|row| near_anchor(row, anchor_created_at))
        {
            by_id.entry(row.event.id.clone()).or_insert(row);
        }
    }
    StorageOutcome::Ok(())
}

fn near_anchor(row: &StoredEventRecord, anchor_created_at: u64) -> bool {
    row.event.created_at.abs_diff(anchor_created_at) <= 86_400
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
            sub_id: "author-context-cache".to_owned(),
            event: row.event,
        });
    }
    StorageOutcome::Ok(out)
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

fn diagnostic(id: &str, message: &str) -> AuthorContextFeedDiagnosticInput {
    AuthorContextFeedDiagnosticInput {
        scope: "author-context-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}

fn empty_cached() -> CachedAuthorContext {
    CachedAuthorContext {
        events: Vec::new(),
        source_state: AuthorContextFeedSourceState::Pending,
        anchor_created_at: None,
    }
}
