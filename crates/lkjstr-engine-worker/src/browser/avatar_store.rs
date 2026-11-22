//! Every hit/touch and eviction/insert commits atomically before claiming retention.
use super::{Database, Picture, valid};
use lkjstr_core::engine::avatars::cache::MAX_ENTRIES;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use wasm_bindgen_futures::JsFuture;
use web_sys::{AbortSignal, IdbRequest, IdbTransaction, IdbTransactionMode};
#[path = "avatar_store_change.rs"]
mod change;
#[path = "avatar_records.rs"]
mod records;
enum Change {
    Lookup,
    Put(Picture),
}
struct Reads {
    entries: IdbRequest,
    blob: IdbRequest,
    meta: IdbRequest,
}
type Handler = Closure<dyn FnMut(web_sys::Event)>;
struct Cleanup {
    tx: IdbTransaction,
    request: IdbRequest,
    _handlers: Vec<Handler>,
}
impl Drop for Cleanup {
    fn drop(&mut self) {
        self.request.set_onsuccess(None);
        self.tx.set_oncomplete(None);
        self.tx.set_onabort(None);
        let _ = self.tx.abort();
    }
}
pub async fn lookup(
    database: &Database,
    key: &str,
    signal: &AbortSignal,
) -> Result<Option<Picture>, JsValue> {
    run(database, key, Change::Lookup, signal).await
}
pub async fn put(
    database: &Database,
    key: &str,
    picture: Picture,
    signal: &AbortSignal,
) -> Result<Picture, JsValue> {
    if !valid(&picture) {
        return Err("avatar-cache-image".into());
    }
    run(database, key, Change::Put(picture), signal)
        .await?
        .ok_or_else(|| "avatar-cache-image".into())
}
async fn run(
    database: &Database,
    key: &str,
    change: Change,
    signal: &AbortSignal,
) -> Result<Option<Picture>, JsValue> {
    let connection = database.connection(signal).await?;
    crate::browser::abort::check(Some(signal))?;
    let stores = js_sys::Array::of3(&"meta".into(), &"entries".into(), &"blobs".into());
    let tx = connection
        .db
        .transaction_with_str_sequence_and_mode(&stores, IdbTransactionMode::Readwrite)?;
    let entries = tx.object_store("entries")?;
    let reads = Reads {
        entries: if matches!(change, Change::Put(_)) {
            entries.get_all_with_key_and_limit(&JsValue::UNDEFINED, MAX_ENTRIES as u32 + 1)?
        } else {
            entries.get(&key.into())?
        },
        blob: tx.object_store("blobs")?.get(&key.into())?,
        meta: tx.object_store("meta")?.get(&"totals".into())?,
    };
    // Requests are queued in order. Only the last callback queues the dependent writes.
    let request = reads.meta.clone();
    let outcome = Rc::new(RefCell::new(None));
    let mut handlers = Vec::new();
    let done = js_sys::Promise::new(&mut |resolve, reject| {
        let complete = Handler::new(move |_| {
            let _ = resolve.call0(&JsValue::NULL);
        });
        let abort = Handler::new(move |_| {
            let _ = reject.call0(&JsValue::NULL);
        });
        tx.set_oncomplete(Some(complete.as_ref().unchecked_ref()));
        tx.set_onabort(Some(abort.as_ref().unchecked_ref()));
        handlers.extend([complete, abort]);
    });
    let current_tx = tx.clone();
    let current_signal = signal.clone();
    let current_outcome = outcome.clone();
    let key = key.to_owned();
    let step = Handler::new(move |_| {
        let result = crate::browser::abort::check(Some(&current_signal))
            .and_then(|()| change::apply(&current_tx, &reads, &key, &change));
        let failed = result.is_err();
        *current_outcome.borrow_mut() = Some(result);
        if failed {
            let _ = current_tx.abort();
        }
    });
    request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
    handlers.push(step);
    let cleanup = Cleanup {
        tx: tx.clone(),
        request,
        _handlers: handlers,
    };
    let cancel = tx.clone();
    let abort = crate::browser::abort::listen(signal, move || {
        let _ = cancel.abort();
    })?;
    // Await actual commit/abort, including after cancellation; do not release a permit on a race alone.
    let committed = JsFuture::from(done).await;
    drop(abort);
    drop(cleanup);
    committed?;
    outcome
        .borrow_mut()
        .take()
        .unwrap_or_else(|| Err("avatar-cache-incomplete".into()))
}
