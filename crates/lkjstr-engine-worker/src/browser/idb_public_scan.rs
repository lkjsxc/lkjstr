//! Small ID-ordered pages let legacy migration visit old metadata without a full cache copy.
use super::{idb_events, promise};
use js_sys::Promise;
use lkjstr_core::cache::Record;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbCursorWithValue, IdbDatabase, IdbKeyRange};
const PAGE_ROWS: usize = 32;
const PAGE_BYTES: usize = 4 * 1024 * 1024;

pub async fn page(
    db: &IdbDatabase,
    after: Option<&str>,
) -> Result<(Vec<Record>, Option<String>), String> {
    let tx = db
        .transaction_with_str("events")
        .map_err(|_| "Cache scan transaction failed")?;
    let store = tx
        .object_store("events")
        .map_err(|_| "Cache scan store missing")?;
    let range: JsValue = match after {
        Some(key) => IdbKeyRange::lower_bound_with_open(&key.into(), true)
            .map_err(|_| "Cache scan cursor failed")?
            .into(),
        None => JsValue::NULL,
    };
    let request = store
        .open_cursor_with_range(&range)
        .map_err(|_| "Cache scan cursor failed")?;
    let records = Rc::new(RefCell::new(Vec::new()));
    let last = Rc::new(RefCell::new(None));
    let mut callback = None;
    let done = Promise::new(&mut |resolve, reject| {
        let records = records.clone();
        let last = last.clone();
        let current = request.clone();
        let failed = reject.clone();
        let mut scanned = 0;
        let mut bytes = 0;
        let step = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let Ok(value) = current.result() else {
                let _ = failed.call1(&JsValue::NULL, &"Cache scan result failed".into());
                return;
            };
            if value.is_null() {
                *last.borrow_mut() = None;
                let _ = resolve.call0(&JsValue::NULL);
                return;
            }
            if scanned >= PAGE_ROWS {
                let _ = resolve.call0(&JsValue::NULL);
                return;
            }
            let cursor: IdbCursorWithValue = value.unchecked_into();
            if let Some(record) = cursor
                .value()
                .ok()
                .and_then(idb_events::read)
                .filter(|row| row.raw.len() <= 1024 * 1024)
            {
                if bytes + record.raw.len() > PAGE_BYTES {
                    let _ = resolve.call0(&JsValue::NULL);
                    return;
                }
                bytes += record.raw.len();
                records.borrow_mut().push(record);
            }
            let Some(key) = cursor
                .key()
                .ok()
                .and_then(|key| key.as_string())
                .filter(|key| lkjstr_protocol::is_event_id(key))
            else {
                let _ = failed.call1(&JsValue::NULL, &"Cache scan key failed".into());
                return;
            };
            *last.borrow_mut() = Some(key);
            scanned += 1;
            if cursor.continue_().is_err() {
                let _ = failed.call1(&JsValue::NULL, &"Cache scan stopped".into());
            }
        });
        request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
        let error = Closure::once_into_js(move |_: web_sys::Event| {
            let _ = reject.call1(&JsValue::NULL, &"Cache scan failed".into());
        });
        request.set_onerror(Some(error.unchecked_ref()));
        callback = Some(step);
    });
    let result = promise::bounded(done, 15, "Cache scan timed out", move || {
        let _ = tx.abort();
    })
    .await;
    request.set_onsuccess(None);
    request.set_onerror(None);
    drop(callback);
    result.map_err(|_| "Cache scan failed")?;
    let next = last.borrow_mut().take();
    let rows = std::mem::take(&mut *records.borrow_mut());
    Ok((rows, next))
}
