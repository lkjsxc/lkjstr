//! Local-first persistence: boot from IndexedDB, then write back in batches.

use leptos::prelude::Update;
use lkjstr_protocol::parse_nostr_event_json;

use super::{App, Rt, Storage};
use crate::host::{after, idb};

/// Events reloaded at startup, newest first.
const BOOT_EVENTS: usize = 8_000;
const FLUSH_MS: u64 = 1_500;
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
        self.with(|rt| {
            if let Some(db) = &rt.db {
                let _ = idb::kv_put(db, key, value);
            }
        });
    }

    fn save_scores_later(self) {
        after(SCORES_MS, move || {
            self.with(|rt| {
                if let (Some(db), Ok(text)) = (&rt.db, serde_json::to_string(&rt.scores)) {
                    let _ = idb::kv_put(db, "scores", &text);
                }
            });
            self.save_scores_later();
        });
    }
}

impl Rt {
    pub(super) fn schedule_persist(&mut self) {
        if self.flags.persist || self.db.is_none() {
            return;
        }
        self.flags.persist = true;
        if let Some(app) = self.app() {
            after(FLUSH_MS, move || app.update(Rt::flush));
        }
    }

    fn flush(&mut self) {
        self.flags.persist = false;
        let batch = std::mem::take(&mut self.unsaved);
        let Some(db) = &self.db else { return };
        let rows: Vec<(String, u64, String)> = batch
            .iter()
            .filter_map(|event| {
                let raw = serde_json::to_string(event).ok()?;
                Some((event.id.clone(), event.created_at, raw))
            })
            .collect();
        if let Err(error) = idb::put_events(db, &rows) {
            self.storage = Storage::Unavailable(error);
        }
    }
}
