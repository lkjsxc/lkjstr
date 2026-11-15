//! Bounded cache boot and committed incremental persistence, with retry.
use super::*;
pub(super) fn load(host: &Rc<RefCell<Host>>) {
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        match idb::open().await {
            Ok(db) => {
                let saved = idb::kv_get(&db, "engine-accounts").await.ok().flatten();
                let routes = idb::kv_get(&db, "publication-routes-v1")
                    .await
                    .ok()
                    .flatten();
                let cached = idb::newest_events(&db, 2000).await;
                let complete = match (&cached, idb::count_events(&db).await) {
                    (Ok(rows), Ok(count)) => count as usize <= rows.len(),
                    _ => false,
                };
                if let Some(h) = weak.upgrade() {
                    let mut h = h.borrow_mut();
                    if h.stopped {
                        db.close();
                        return;
                    }
                    h.db = Some(db);
                    h.engine.cached_history_complete = complete;
                    if let Some(saved) = saved {
                        h.accounts = serde_json::from_str(&saved).unwrap_or_default();
                    }
                    h.engine.seen = h.accounts.seen.clone();
                    h.engine.notification_ties = h.accounts.notification_ties.clone();
                    if let Some(routes) = routes {
                        h.engine.network.restore_publication_routes(&routes);
                    }
                    h.loaded = true;
                    for id in h.sessions.keys().copied().collect::<Vec<_>>() {
                        accounts::ready(&h, id, matches!(h.scope, Sink::Shared { .. }));
                    }
                    let queued = std::mem::take(&mut h.startup);
                    for (id, input) in queued {
                        h.receive(id, input);
                    }
                    match cached {
                        Ok(rows) => {
                            let dropped = h.engine.dropped;
                            for raw in rows {
                                if let Ok(e) = lkjstr_protocol::compact::decode(&raw) {
                                    h.engine.enqueue("cache".into(), e);
                                } else {
                                    h.engine.cached_history_complete = false;
                                }
                            }
                            h.engine.cached_history_complete &= h.engine.dropped == dropped;
                        }
                        Err(_) => post(
                            &h,
                            &Output::Error {
                                req: None,
                                code: "cache-read-failed".into(),
                            },
                        ),
                    }
                }
            }
            Err(_) => {
                if let Some(h) = weak.upgrade() {
                    post(
                        &h.borrow(),
                        &Output::Error {
                            req: None,
                            code: "storage-unavailable".into(),
                        },
                    );
                }
            }
        }
    });
}
pub(super) fn persist(host: &Rc<RefCell<Host>>) {
    let work = {
        let mut h = host.borrow_mut();
        if h.stopped
            || h.flushing
            || (h.engine.pending.is_empty()
                && h.publication_persisted == h.engine.network.publication_revision)
            || now() < h.next_persist
        {
            return;
        }
        let Some(db) = h.db.clone() else {
            return;
        };
        h.flushing = true;
        h.next_persist = now() + 1500;
        let batch = h.engine.pending.batch();
        let rows = batch
            .iter()
            .filter_map(|e| {
                lkjstr_protocol::compact::encode(e)
                    .ok()
                    .map(|raw| (e.id.clone(), e.created_at, raw))
            })
            .collect::<Vec<_>>();
        let routes = h.engine.network.publication_routes_json();
        let revision = h.engine.network.publication_revision;
        (db, rows, batch, routes, revision)
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let begin = crate::measure::now();
        let result = match idb::kv_put(&work.0, "publication-routes-v1", &work.3).await {
            Ok(()) => idb::put_events(&work.0, &work.1).await,
            Err(error) => Err(error),
        };
        // Physical disk bound: keep the newest 20000; run only after a committed batch.
        if result.is_ok()
            && let Ok(count) = idb::count_events(&work.0).await
            && count > 20000
        {
            let _ = idb::delete_oldest(&work.0, count - 20000).await;
        }
        if let Some(h) = weak.upgrade() {
            let mut h = h.borrow_mut();
            h.flushing = false;
            if result.is_ok() {
                h.engine.pending.committed(&work.2);
                h.publication_persisted = work.4;
                h.engine.metrics.commit(crate::measure::now() - begin);
            } else {
                post(
                    &h,
                    &Output::Error {
                        req: None,
                        code: "storage-write-failed".into(),
                    },
                );
            }
        }
    });
}
