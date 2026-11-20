//! Store-first hydration for held public screen identities; never reads account archives.
use super::*;
use std::collections::BTreeSet;
#[derive(Default)]
pub(super) struct State {
    loading: bool,
    retry_at: u64,
}
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    let work = {
        let mut h = host.borrow_mut();
        if h.stopped || !h.loaded {
            return;
        }
        for (id, session) in &h.sessions {
            for out in session.borrow_mut().cache_refresh(&h.engine) {
                h.scope.direct(*id, &out);
            }
        }
        let wants = h
            .sessions
            .iter()
            .flat_map(|(id, session)| {
                session
                    .borrow()
                    .cache_unresolved_ids(&h.engine)
                    .into_iter()
                    .filter_map(|(sub, ids)| {
                        let sub = match &h.scope {
                            Sink::Shared { clients, .. } => clients.subscription(*id, &sub),
                            Sink::Dedicated(_) => Some(sub),
                            Sink::Closed => None,
                        }?;
                        Some((sub, ids))
                    })
                    .collect::<Vec<_>>()
            })
            .collect();
        let at = h.time();
        h.engine.cache_references(wants, at);
        if h.public_cache.loading || now() < h.public_cache.retry_at {
            return;
        }
        let Some(db) = h.db.clone() else { return };
        let ids: Vec<_> = h
            .sessions
            .values()
            .flat_map(|s| s.borrow().cache_missing_ids(&h.engine))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .take(32)
            .collect();
        if ids.is_empty() {
            return;
        }
        h.public_cache.loading = true;
        (db, ids)
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let begin = crate::measure::now();
        let result = crate::browser::idb_public::references(&work.0, &work.1).await;
        let Some(host) = weak.upgrade() else { return };
        let mut h = host.borrow_mut();
        h.public_cache.loading = false;
        if h.stopped {
            return;
        }
        h.sign_trace.span(sign_trace::Activity::Idb, begin);
        let begin = crate::measure::now();
        match result {
            Ok((rows, scanned)) => {
                h.engine.restore_cache(&rows);
                for (id, session) in &h.sessions {
                    let mut session = session.borrow_mut();
                    session.cache_mark_loaded(&scanned);
                    for out in session.cache_refresh(&h.engine) {
                        h.scope.direct(*id, &out);
                    }
                }
            }
            Err(_) => {
                h.public_cache.retry_at = now().saturating_add(2000);
                post(
                    &h,
                    &Output::Error {
                        req: None,
                        code: "cache-read-failed".into(),
                    },
                );
            }
        }
        h.sign_trace.span(sign_trace::Activity::Cache, begin);
    });
}
