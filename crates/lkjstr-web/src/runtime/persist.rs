//! Local-first persistence: boot from IndexedDB, then write back in batches.

use leptos::prelude::Update;
use lkjstr_protocol::parse_nostr_event_json;

use super::{App, Rt, Storage};
use crate::host::{after, idb};

/// Events reloaded at startup, newest first.
const BOOT_EVENTS: usize = 8_000;
const FLUSH_MS: u64 = 1_500;
/// Rows kept in IndexedDB; above `PRUNE_AT` the oldest go at startup.
const KEEP_STORED: u32 = 50_000;
const PRUNE_AT: u32 = 60_000;
const SCORES_MS: u64 = 30_000;

/// Raw stored UI state handed to the shell after boot.
pub struct Boot {
    pub workspace: Option<String>,
    pub settings: Option<String>,
}

impl App {
    /// Opens storage, reloads events, session and scores, then calls `ready`.
    pub fn boot(self, ready: impl FnOnce(Boot) + 'static) {
        leptos::task::spawn_local(async move {
            let mut boot = Boot {
                workspace: None,
                settings: None,
            };
            match idb::open().await {
                Ok(db) => {
                    let raw = idb::newest_events(&db, BOOT_EVENTS)
                        .await
                        .unwrap_or_default();
                    let session = idb::kv_get(&db, "session").await.ok().flatten();
                    let scores = idb::kv_get(&db, "scores").await.ok().flatten();
                    boot.workspace = idb::kv_get(&db, "workspace").await.ok().flatten();
                    boot.settings = idb::kv_get(&db, "settings").await.ok().flatten();
                    let secrets = match &session {
                        Some(text) => super::session::load_secrets(&db, text).await,
                        None => Vec::new(),
                    };
                    self.update(|rt| {
                        rt.db = Some(db);
                        let mut loaded = 0;
                        // Rows were verified before they were written.
                        for text in raw.iter().rev() {
                            if let Ok(event) = parse_nostr_event_json(text, None) {
                                rt.store.insert(event, None);
                                loaded += 1;
                            }
                        }
                        rt.storage = Storage::Ready { loaded };
                        if let Some(scores) = scores.and_then(|s| serde_json::from_str(&s).ok()) {
                            rt.scores = scores;
                        }
                        rt.session.restore(session.as_deref(), secrets);
                    });
                    self.save_scores_later();
                    self.prune_later();
                }
                Err(error) => self.update(|rt| rt.storage = Storage::Unavailable(error)),
            }
            self.update(|rt| rt.apply_session_relays());
            self.rev.update(|rev| *rev += 1);
            self.session_rev.update(|rev| *rev += 1);
            self.net_rev.update(|rev| *rev += 1);
            ready(boot);
        });
    }

    pub async fn kv_get(&self, key: &str) -> Option<String> {
        let db = self.with(|rt| rt.db.clone())?;
        idb::kv_get(&db, key).await.ok().flatten()
    }

    pub fn kv_put(&self, key: &str, value: &str) {
        let Some(db) = self.with(|rt| rt.db.clone()) else {
            return;
        };
        let (key, value, app) = (key.to_owned(), value.to_owned(), *self);
        leptos::task::spawn_local(async move {
            if let Err(error) = idb::kv_put(&db, &key, &value).await {
                app.storage_failed(error);
            }
        });
    }

    fn storage_failed(self, error: String) {
        self.update(|rt| rt.storage = Storage::WriteFailed(error));
        self.rev.update(|rev| *rev += 1);
    }

    /// Bounds the on-disk cache after startup work has settled.
    fn prune_later(self) {
        after(20_000, move || {
            let Some(db) = self.with(|rt| rt.db.clone()) else {
                return;
            };
            leptos::task::spawn_local(async move {
                if let Ok(count) = idb::count_events(&db).await
                    && count > PRUNE_AT
                    && let Err(error) = idb::delete_oldest(&db, count - KEEP_STORED).await
                {
                    self.storage_failed(error);
                }
            });
        });
    }

    fn save_scores_later(self) {
        after(SCORES_MS, move || {
            if let Ok(text) = self.with(|rt| serde_json::to_string(&rt.scores)) {
                self.kv_put("scores", &text);
            }
            self.save_scores_later();
        });
    }
}

impl Rt {
    pub(super) fn schedule_persist(&mut self) {
        if self.flags.persist || self.db.is_none() || self.unsaved.is_empty() {
            return;
        }
        self.flags.persist = true;
        if let Some(app) = self.app() {
            after(FLUSH_MS, move || app.flush());
        }
    }
}

impl App {
    fn flush(self) {
        let Some((db, batch)) = self.with(|rt| Some((rt.db.clone()?, rt.unsaved.batch()))) else {
            self.update(|rt| rt.flags.persist = false);
            return;
        };
        leptos::task::spawn_local(async move {
            let rows = batch
                .iter()
                .map(|event| {
                    serde_json::to_string(event)
                        .map(|raw| (event.id.clone(), event.created_at, raw))
                })
                .collect::<Result<Vec<_>, _>>();
            let result = match rows {
                Ok(rows) => idb::put_events(&db, &rows).await,
                Err(error) => Err(error.to_string()),
            };
            self.update(|rt| {
                rt.flags.persist = false;
                match result {
                    Ok(()) => {
                        rt.unsaved.committed(&batch);
                        rt.storage = Storage::Ready {
                            loaded: rt.store.len(),
                        };
                    }
                    Err(error) => rt.storage = Storage::WriteFailed(error),
                }
                rt.schedule_persist();
            });
            self.rev.update(|rev| *rev += 1);
        });
    }
}
