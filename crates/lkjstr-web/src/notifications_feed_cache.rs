use lkjstr_app::{
    FeedWindowEvidence, FeedWindowFlags, FeedWindowState, NotificationItemInput,
    NotificationsFeedDiagnosticInput, reduce_feed_window,
};
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{NotificationRecord, StorageOutcome};

use crate::{
    host_status::problem_status,
    notifications_feed_host::{NotificationsFeedHost, PAGE_SIZE},
    notifications_feed_host_diagnostics::diagnostic,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_event_get, sqlite_event_relays, sqlite_notifications_for_owner},
};

#[derive(Default)]
pub(crate) struct CachedNotifications {
    pub(crate) items: Vec<NotificationItemInput>,
    events: Vec<ProgressiveEvent>,
    pub(crate) diagnostics: Vec<NotificationsFeedDiagnosticInput>,
}

impl CachedNotifications {
    pub(crate) fn into_parts(
        self,
        window: FeedWindowState,
    ) -> (
        Vec<NotificationItemInput>,
        Vec<NotificationsFeedDiagnosticInput>,
        FeedWindowState,
    ) {
        let window = reduce_feed_window(
            window,
            FeedWindowEvidence::Events {
                generation: 1,
                events: self.events,
                flags: FeedWindowFlags::default(),
            },
        );
        (self.items, self.diagnostics, window)
    }
}

pub(crate) async fn cached_notifications(
    host: &NotificationsFeedHost,
    active_pubkey: &str,
    selected_relays: Vec<String>,
) -> CachedNotifications {
    let rows = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let notifications =
            sqlite_notifications_for_owner(&store, active_pubkey, u64::MAX, PAGE_SIZE).await;
        let notifications = match notifications {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| CachedNotifications::default()),
        };
        let mut cached = CachedNotifications::default();
        for notification in notifications {
            cached.items.push(notification_input(&notification));
            let event = sqlite_event_get(&store, &notification.source_event_id).await;
            match event {
                StorageOutcome::Ok(Some(row)) => {
                    let relays = event_relays(&store, &notification.source_event_id, &mut cached)
                        .await
                        .unwrap_or_else(|| selected_relays.clone());
                    cached.events.push(ProgressiveEvent {
                        relays,
                        sub_id: "notifications-cache".to_owned(),
                        event: row.event,
                    });
                }
                StorageOutcome::Ok(None) => {}
                outcome => cached.diagnostics.push(diagnostic(
                    "event-cache",
                    &problem_status("Cached notification event unavailable", outcome),
                )),
            }
        }
        StorageOutcome::Ok(cached)
    })
    .await;
    match rows {
        StorageOutcome::Ok(rows) => rows,
        outcome => {
            let mut rows = CachedNotifications::default();
            rows.diagnostics.push(diagnostic(
                "notifications-cache",
                &problem_status("Cached notifications unavailable", outcome),
            ));
            rows
        }
    }
}

async fn event_relays(
    store: &crate::sqlite_store::SqliteStore,
    event_id: &str,
    cached: &mut CachedNotifications,
) -> Option<Vec<String>> {
    match sqlite_event_relays(store, event_id).await {
        StorageOutcome::Ok(rows) => Some(rows.into_iter().map(|row| row.relay_url).collect()),
        outcome => {
            cached.diagnostics.push(diagnostic(
                "event-relays",
                &problem_status("Cached notification relay provenance unavailable", outcome),
            ));
            None
        }
    }
}

fn notification_input(row: &NotificationRecord) -> NotificationItemInput {
    NotificationItemInput {
        notification_id: row.notification_id.clone(),
        notification_kind: row.notification_kind.clone(),
        source_event_id: Some(row.source_event_id.clone()),
    }
}
