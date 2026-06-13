use std::collections::BTreeMap;

use lkjstr_app::{
    FeedWindowEvidence, FeedWindowFlags, GlobalFeedDiagnosticInput, GlobalFeedSourceState,
    empty_feed_window, global_feed_id, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, normalize_relay_url};
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::{
    global_feed_coverage::{GlobalCoverageInput, global_coverage_source_state},
    global_feed_host::{GlobalFeedHost, PAGE_SIZE, WINDOW_MAX, diagnostic, storage_problem},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_event_relays, sqlite_events_by_kind, sqlite_feed_coverage_for_feed},
};

pub(crate) async fn global_cache_state(
    host: &GlobalFeedHost,
    owner: &str,
    selected_relays: &[String],
    now_sec: u64,
    diagnostics: &mut Vec<GlobalFeedDiagnosticInput>,
) -> (lkjstr_app::FeedWindowState, GlobalFeedSourceState) {
    let source_state = cache_source_state(host, owner, selected_relays, now_sec).await;
    let filter = GlobalCacheFilter::new(&source_state, selected_relays, now_sec);
    let events = cached_events(host, filter).await;
    let window = match events {
        StorageOutcome::Ok(events) => window_from_events(events),
        outcome => {
            diagnostics.push(diagnostic(
                "cache-events",
                &storage_problem("Cached Global events unavailable", outcome),
            ));
            empty_feed_window(1, WINDOW_MAX)
        }
    };
    (window, source_state)
}

async fn cache_source_state(
    host: &GlobalFeedHost,
    owner: &str,
    selected_relays: &[String],
    now_sec: u64,
) -> GlobalFeedSourceState {
    let feed_key = global_feed_id(owner);
    let coverage = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_feed_coverage_for_feed(&store, &feed_key).await
    })
    .await;
    match coverage {
        StorageOutcome::Ok(rows) => global_coverage_source_state(
            &rows,
            GlobalCoverageInput {
                owner,
                selected_relays,
                since: now_sec.saturating_sub(30),
                until: now_sec,
            },
        ),
        outcome => GlobalFeedSourceState::Partial {
            reason: storage_problem("Feed coverage unavailable", outcome),
            retry_available: true,
        },
    }
}

async fn cached_events(
    host: &GlobalFeedHost,
    filter: GlobalCacheFilter,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let rows = match sqlite_events_by_kind(&store, KIND_TEXT_NOTE, u64::MAX, PAGE_SIZE).await {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| Vec::new()),
        };
        let mut by_id = BTreeMap::<String, StoredEventRecord>::new();
        for row in rows {
            if filter.accepts_event(&row) {
                by_id.entry(row.event.id.clone()).or_insert(row);
            }
        }
        events_with_relays(&store, by_id, filter).await
    })
    .await
}

async fn events_with_relays(
    store: &crate::sqlite_store::SqliteStore,
    rows: BTreeMap<String, StoredEventRecord>,
    filter: GlobalCacheFilter,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    let mut out = Vec::with_capacity(rows.len());
    for row in rows.into_values() {
        let relays: Vec<String> = match sqlite_event_relays(store, &row.event.id).await {
            StorageOutcome::Ok(rows) => rows.into_iter().map(|item| item.relay_url).collect(),
            outcome => return outcome.map(|_| Vec::new()),
        };
        if !filter.accepts_relays(&relays) {
            continue;
        }
        out.push(ProgressiveEvent {
            relays,
            sub_id: "global-cache".to_owned(),
            event: row.event,
        });
    }
    StorageOutcome::Ok(out)
}

fn window_from_events(events: Vec<ProgressiveEvent>) -> lkjstr_app::FeedWindowState {
    let has_older = !events.is_empty();
    reduce_feed_window(
        empty_feed_window(1, WINDOW_MAX),
        FeedWindowEvidence::Events {
            generation: 1,
            events,
            flags: FeedWindowFlags {
                has_older,
                ..FeedWindowFlags::default()
            },
        },
    )
}

struct GlobalCacheFilter {
    relays: Vec<String>,
    range: Option<(u64, u64)>,
}

impl GlobalCacheFilter {
    fn new(source_state: &GlobalFeedSourceState, selected_relays: &[String], now_sec: u64) -> Self {
        let range = (source_state == &GlobalFeedSourceState::CacheComplete)
            .then_some((now_sec.saturating_sub(30), now_sec));
        Self {
            relays: selected_relays
                .iter()
                .filter_map(|relay| normalize_relay_url(relay))
                .collect(),
            range,
        }
    }

    fn accepts_event(&self, row: &StoredEventRecord) -> bool {
        self.range.is_none_or(|(since, until)| {
            row.event.created_at >= since && row.event.created_at < until
        })
    }

    fn accepts_relays(&self, relays: &[String]) -> bool {
        relays.iter().any(|relay| {
            normalize_relay_url(relay)
                .as_ref()
                .is_some_and(|normalized| self.relays.contains(normalized))
        })
    }
}
