//! Bounded cursor pages; no timestamp eviction and no full body snapshot.
use super::{idb_events, idb_retention::hint, promise};
use lkjstr_core::cache::{Record, durable::Hint};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbCursorWithValue, IdbDatabase, IdbKeyRange};

pub(super) async fn page(
    db: &IdbDatabase,
    after: Option<&str>,
) -> Result<(Vec<(Record, Hint)>, Option<String>), String> {
    let tx = db
        .transaction_with_str("events")
        .map_err(|_| "retention scan unavailable")?;
    let store = tx
        .object_store("events")
        .map_err(|_| "retention store unavailable")?;
    let range: JsValue = match after {
        Some(id) => IdbKeyRange::lower_bound_with_open(&id.into(), true)
            .map_err(|_| "retention cursor failed")?
            .into(),
        None => JsValue::NULL,
    };
    let request = store
        .open_cursor_with_range(&range)
        .map_err(|_| "retention scan failed")?;
    let rows = Rc::new(RefCell::new(Vec::new()));
    let last = Rc::new(RefCell::new(None));
    let mut callback = None;
    let done = js_sys::Promise::new(&mut |resolve, reject| {
        let current = request.clone();
        let rows = rows.clone();
        let last = last.clone();
        let mut bytes = 0;
        let step = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let run = || -> Result<(), JsValue> {
                let value = current.result()?;
                if value.is_null() {
                    *last.borrow_mut() = None;
                    let _ = resolve.call0(&JsValue::NULL);
                    return Ok(());
                }
                if rows.borrow().len() >= 32 || bytes >= 4 * 1024 * 1024 {
                    let _ = resolve.call0(&JsValue::NULL);
                    return Ok(());
                }
                let cursor: IdbCursorWithValue = value.unchecked_into();
                let value = cursor.value()?;
                let id = cursor.key()?.as_string().ok_or("invalid durable key")?;
                let record = idb_events::read(value.clone())
                    .filter(|row| row.id == id)
                    .unwrap_or_else(|| Record {
                        id: id.clone(),
                        created_at: 0,
                        kind: None,
                        raw: js_sys::JSON::stringify(&value)
                            .ok()
                            .and_then(|value| value.as_string())
                            .unwrap_or_default(),
                        receipt: None,
                    });
                bytes += record.raw.len();
                rows.borrow_mut().push((record, hint(&value)));
                *last.borrow_mut() = Some(id);
                cursor.continue_()
            };
            let mut run = run;
            if let Err(error) = run() {
                let _ = reject.call1(&JsValue::NULL, &error);
            }
        });
        request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
        callback = Some(step);
    });
    let result = promise::bounded(done, 15, "retention scan timed out", move || {
        let _ = tx.abort();
    })
    .await;
    request.set_onsuccess(None);
    drop(callback);
    result.map_err(|_| "retention scan failed")?;
    let next = last.borrow_mut().take();
    let output = std::mem::take(&mut *rows.borrow_mut());
    Ok((output, next))
}
