//! Bounded cache boot and committed incremental persistence, with retry.
use super::*;
pub(super) fn load(host: &Rc<RefCell<Host>>) {
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        match idb::open().await {
            Ok(db) => {
                let cached = idb::newest_events(&db, 2000).await;
                if let Some(h) = weak.upgrade() {
                    let mut h = h.borrow_mut();
                    if h.stopped {
                        db.close();
                        return;
                    }
                    h.db = Some(db);
                    match cached {
                        Ok(rows) => {
                            for raw in rows {
                                if let Ok(e) = lkjstr_protocol::parse_nostr_event_json(&raw, None) {
                                    h.engine.enqueue("cache".into(), e);
                                }
                            }
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
        if h.stopped || h.flushing || h.engine.pending.is_empty() || now() < h.next_persist {
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
                serde_json::to_string(e)
                    .ok()
                    .map(|raw| (e.id.clone(), e.created_at, raw))
            })
            .collect::<Vec<_>>();
        (db, rows, batch)
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let begin = crate::measure::now();
        let result = idb::put_events(&work.0, &work.1).await;
        if let Some(h) = weak.upgrade() {
            let mut h = h.borrow_mut();
            h.flushing = false;
            if result.is_ok() {
                h.engine.pending.committed(&work.2);
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
