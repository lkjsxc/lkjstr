//! Committed incremental persistence, with retry.
use super::*;
pub(super) fn persist(host: &Rc<RefCell<Host>>) {
    let work = {
        let mut h = host.borrow_mut();
        if h.stopped
            || h.flushing
            || (h.engine.pending.is_empty()
                && h.publication_persisted == h.engine.network.publication_revision
                && h.quality_persisted == h.engine.network.quality_revision
                && !h.engine.read_contexts.pending())
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
            .filter_map(|e| lkjstr_core::cache::Record::verified(e).ok())
            .collect::<Vec<_>>();
        let routes = h.engine.network.publication_routes_json();
        let revision = h.engine.network.publication_revision;
        (
            db,
            rows,
            batch,
            routes,
            revision,
            h.engine.network.quality_json(h.time()),
            h.engine.network.quality_revision,
            h.engine
                .read_contexts
                .batch(&h.engine.store, &h.engine.zaps.receipts),
        )
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let begin = crate::measure::now();
        let result = match idb::kv_put(&work.0, "publication-routes-v1", &work.3).await {
            Ok(()) => match idb::kv_put(&work.0, "relay-quality-v1", &work.5).await {
                Ok(()) => idb::put_read_contexts(&work.0, &work.1, &work.7.contexts).await,
                Err(error) => Err(error),
            },
            Err(error) => Err(error),
        };
        // Event-row retention bound: keep the newest 20000 after a committed batch.
        if result.is_ok()
            && let Ok(count) = idb::count_events(&work.0).await
            && count > 20000
        {
            let _ = idb::delete_oldest(&work.0, count - 20000).await;
        }
        if let Some(h) = weak.upgrade() {
            let mut h = h.borrow_mut();
            h.flushing = false;
            h.sign_trace.span(sign_trace::Activity::Idb, begin);
            if let Ok(contexts) = result {
                if h.engine.contexts_committed(&work.7, contexts).is_err() {
                    post(
                        &h,
                        &Output::Error {
                            req: None,
                            code: "cache-read-failed".into(),
                        },
                    );
                }
                h.engine.public_policy_committed(&work.2);
                let policy_was_pending = h.engine.pending.public_policy_pending();
                h.engine.pending.committed(&work.2);
                if policy_was_pending && !h.engine.pending.public_policy_pending() {
                    h.engine.invalidate();
                }
                h.publication_persisted = work.4;
                h.quality_persisted = work.6;
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
