use std::collections::BTreeMap;

use lkjstr_protocol::KIND_TEXT_NOTE;
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::{
    home_feed_cache_filter::CacheCompleteFilter,
    home_feed_host::{HomeFeedHost, PAGE_SIZE},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_event_relays, sqlite_events_by_author_kind},
};

pub(crate) async fn cached_events(
    host: &HomeFeedHost,
    authors: Vec<String>,
    filter: Option<CacheCompleteFilter>,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let mut by_id = BTreeMap::<String, StoredEventRecord>::new();
        for author in authors.into_iter().take(128) {
            let rows = match sqlite_events_by_author_kind(
                &store,
                &author,
                KIND_TEXT_NOTE,
                u64::MAX,
                PAGE_SIZE,
            )
            .await
            {
                StorageOutcome::Ok(rows) => rows,
                outcome => return outcome.map(|_| Vec::new()),
            };
            for row in rows {
                if filter
                    .as_ref()
                    .is_some_and(|filter| !filter.accepts_event(&row))
                {
                    continue;
                }
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
    filter: Option<CacheCompleteFilter>,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    let mut out = Vec::with_capacity(rows.len());
    for row in rows.into_values() {
        let relays = match sqlite_event_relays(store, &row.event.id).await {
            StorageOutcome::Ok(rows) => rows
                .into_iter()
                .map(|item| item.relay_url)
                .collect::<Vec<_>>(),
            outcome => return outcome.map(|_| Vec::new()),
        };
        if filter
            .as_ref()
            .is_some_and(|filter| !filter.accepts_relays(&relays))
        {
            continue;
        }
        out.push(ProgressiveEvent {
            relays,
            sub_id: "home-cache".to_owned(),
            event: row.event,
        });
    }
    StorageOutcome::Ok(out)
}
