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
                && !h.engine.read_contexts.pending()
                && !h.retention_due)
            || now() < h.next_persist
        {
            return;
        }
        let Some(db) = h.db.clone() else {
            return;
        };
        h.flushing = true;
        h.next_persist = now() + 1500;
        let batch = if h.retention_due {
            h.engine.pending.recovery_batch()
        } else {
            h.engine.pending.batch()
        };
        let mut rows = batch
            .iter()
            .filter_map(|e| lkjstr_core::cache::Record::verified(&e.to_nostr()).ok())
            .collect::<Vec<_>>();
        let contexts = h
            .engine
            .read_contexts
            .batch(&h.engine.store, &h.engine.zaps.receipts);
        // Clean startup maintenance needs no synchronous metadata or graph census.
        let (access, metadata) =
            if h.retention_due && batch.is_empty() && contexts.contexts.is_empty() {
                (lkjstr_core::cache::MetadataAccess::default(), Vec::new())
            } else {
                h.engine.cache_metadata_observation(h.time())
            };
        let mut ids: std::collections::BTreeSet<_> =
            rows.iter().map(|row| row.id.clone()).collect();
        rows.extend(
            metadata
                .into_iter()
                .filter(|_| !batch.is_empty() || !h.retention_due)
                .filter(|row| ids.insert(row.id.clone())),
        );
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
            contexts,
            access,
        )
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let begin = crate::measure::now();
        let result = match idb::kv_put(&work.0, "publication-routes-v1", &work.3).await {
            Ok(()) => match idb::kv_put(&work.0, "relay-quality-v1", &work.5).await {
                Ok(()) => {
                    if work.1.is_empty() && work.7.contexts.is_empty() {
                        Ok(None)
                    } else {
                        // Observe only actual cache writes, after the asynchronous IDB boundary.
                        // This also captures newly opened windows before their bodies are scored.
                        if let Some(durable) = observation(&weak, &Default::default()) {
                            idb::put_read_contexts(
                                &work.0,
                                &work.1,
                                &work.7.contexts,
                                &work.8,
                                &durable,
                            )
                            .await
                        } else {
                            Err("persistence stopped".into())
                        }
                    }
                }
                Err(error) => Err(error),
            },
            Err(error) => Err(error),
        };
        let pin_host = weak.clone();
        let retention = idb::retain(&work.0, move |authors| observation(&pin_host, authors)).await;
        if let Some(h) = weak.upgrade() {
            let mut h = h.borrow_mut();
            h.flushing = false;
            h.retention_due = retention.unwrap_or(true) || result.is_err();
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
                h.engine.public_policy_leases_committed(&work.2);
                let policy_was_pending = h.engine.pending.public_policy_pending();
                h.engine.pending.committed(&work.2);
                if !work.2.is_empty() {
                    h.wake();
                }
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

fn observation(
    weak: &std::rc::Weak<RefCell<Host>>,
    authors: &std::collections::BTreeSet<String>,
) -> Option<lkjstr_core::cache::durable::Access> {
    let host = weak.upgrade()?;
    let h = host.borrow();
    (!h.stopped).then(|| h.engine.durable_retention_for_authors(h.time(), authors))
}
