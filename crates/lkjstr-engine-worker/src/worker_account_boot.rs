//! Account boot never treats unavailable or malformed storage as an empty wallet.
use super::*;
use crate::browser::idb_accounts::{self, Change, Reply};
use lkjstr_core::engine::account_storage;
pub(super) fn load(host: &Rc<RefCell<Host>>) {
    let controller = match web_sys::AbortController::new() {
        Ok(value) => value,
        Err(_) => {
            account_failure::fail(&mut host.borrow_mut());
            return;
        }
    };
    let signal = controller.signal();
    host.borrow_mut().account_store.opening = Some(controller);
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let db = match idb::open(&signal).await {
            Ok(db) => db,
            Err(_) => {
                if let Some(host) = weak.upgrade() {
                    account_failure::fail(&mut host.borrow_mut());
                }
                return;
            }
        };
        // Public cache reads precede the secret-bearing account snapshot. Abort
        // checks bound stopped-host retention without rebuilding any account data.
        let routes = idb::kv_get(&db, "publication-routes-v1")
            .await
            .ok()
            .flatten();
        if signal.aborted() {
            db.close();
            return;
        }
        let quality = idb::kv_get(&db, "relay-quality-v1").await.ok().flatten();
        if signal.aborted() {
            db.close();
            return;
        }
        let metadata = crate::browser::idb_public::metadata(&db, &signal).await;
        if signal.aborted() {
            db.close();
            return;
        }
        let contexts = idb::read_contexts(&db).await;
        if signal.aborted() {
            db.close();
            return;
        }
        let cached = idb::newest_events(&db, 2000).await;
        if signal.aborted() {
            db.close();
            return;
        }
        let complete = match (&cached, idb::count_events(&db).await) {
            (Ok(rows), Ok(count)) => count as usize <= rows.len(),
            _ => false,
        };
        let loaded = match idb_accounts::run(&db, Change::Load, &signal).await {
            Ok(Reply::Loaded(value)) => value,
            _ => {
                db.close();
                if let Some(host) = weak.upgrade() {
                    account_failure::fail(&mut host.borrow_mut());
                }
                return;
            }
        };
        let Some(host) = weak.upgrade() else {
            db.close();
            return;
        };
        let mut h = host.borrow_mut();
        if h.stopped || signal.aborted() {
            db.close();
            return;
        }
        h.db = Some(db);
        h.account_store.opening = None;
        h.account_store.state = account_storage::State::Ready(loaded.revision);
        h.accounts = loaded.accounts;
        h.engine.cached_history_complete = complete;
        for state in h.accounts.notification_zaps.values_mut() {
            state.normalize();
        }
        h.engine.seen = h.accounts.seen.clone();
        h.engine.notification_ties = h.accounts.notification_ties.clone();
        h.engine.notification_zaps = h.accounts.notification_zaps.clone();
        if let Some(routes) = routes {
            h.engine.network.restore_publication_routes(&routes);
        }
        if let Some(quality) = quality {
            h.engine.network.restore_quality(&quality, now());
        }
        // Resolve stored names/follows before any view can plan relay work.
        let mut cache_failed = metadata.is_err() || cached.is_err() || contexts.is_err();
        match metadata {
            Ok(rows) => h.engine.restore_cache(&rows),
            Err(_) => h.engine.cached_history_complete = false,
        }
        if let Ok(contexts) = contexts {
            cache_failed |= h.engine.restore_contexts(contexts).is_err();
        }
        match cached {
            Ok(rows) => h.engine.restore_cache(&rows),
            Err(_) => h.engine.cached_history_complete = false,
        }
        h.loaded = true;
        for id in h.sessions.keys().copied().collect::<Vec<_>>() {
            let shared = matches!(h.scope, Sink::Shared { .. });
            accounts::ready(&mut h, id, shared);
        }
        let queued = std::mem::take(&mut h.startup);
        // Inspection already observed pre-boot visibility/detach input.
        h.storage.replaying_startup = true;
        for (id, input) in queued {
            h.receive(id, input);
        }
        h.storage.replaying_startup = false;
        if cache_failed {
            post(
                &h,
                &Output::Error {
                    req: None,
                    code: "cache-read-failed".into(),
                },
            );
        }
    });
}

pub(super) fn ready(h: &mut Host, id: u64, shared: bool) {
    if h.loaded {
        accounts::ready(h, id, shared);
    } else if account_failure::failed(h) {
        account_failure::ready(h, id, shared);
    }
}
