//! IndexedDB: an `events` store (newest-first reload) and a `kv` store for
//! workspace, accounts, settings and relay scores. One database, no worker.

use std::cell::RefCell;
use std::rc::Rc;

use js_sys::{Object, Promise, Reflect};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbCursorDirection, IdbDatabase, IdbRequest};

pub use super::idb_commit::kv_commit;

// Intentionally incompatible with the legacy `lkjstr` database (version 18).
const DB_NAME: &str = "lkjstr-wasm";

type Step = Closure<dyn FnMut(web_sys::Event)>;
const DB_VERSION: u32 = 1;

fn err(value: JsValue) -> String {
    value
        .as_string()
        .or_else(|| Reflect::get(&value, &"message".into()).ok()?.as_string())
        .unwrap_or_else(|| "IndexedDB error".to_owned())
}

fn settle(request: &IdbRequest) -> Promise {
    let request = request.clone();
    Promise::new(&mut |resolve, reject| {
        let ok_request = request.clone();
        let on_ok = Closure::once_into_js(move |_: web_sys::Event| {
            let _ = resolve.call1(
                &JsValue::NULL,
                &ok_request.result().unwrap_or(JsValue::NULL),
            );
        });
        let on_err = Closure::once_into_js(move |_: web_sys::Event| {
            let _ = reject.call1(&JsValue::NULL, &"request failed".into());
        });
        request.set_onsuccess(Some(on_ok.unchecked_ref()));
        request.set_onerror(Some(on_err.unchecked_ref()));
    })
}

pub async fn open() -> Result<IdbDatabase, String> {
    let factory = web_sys::window()
        .ok_or("no window")?
        .indexed_db()
        .map_err(err)?
        .ok_or("IndexedDB is unavailable in this browser context")?;
    let request = factory.open_with_u32(DB_NAME, DB_VERSION).map_err(err)?;
    let upgrade_request = request.clone();
    let upgrade = Closure::once_into_js(move |_: web_sys::Event| {
        let Ok(result) = upgrade_request.result() else {
            return;
        };
        let db: IdbDatabase = result.unchecked_into();
        let names = db.object_store_names();
        if !names.contains("events") {
            let params = web_sys::IdbObjectStoreParameters::new();
            params.set_key_path(&"id".into());
            if let Ok(store) = db.create_object_store_with_optional_parameters("events", &params) {
                let _ = store.create_index_with_str("created_at", "created_at");
            }
        }
        if !names.contains("kv") {
            let _ = db.create_object_store("kv");
        }
    });
    request.set_onupgradeneeded(Some(upgrade.unchecked_ref()));
    let value = super::promise::bounded(
        settle(&request),
        15,
        "Local storage did not answer. Reload to try again.",
        || {},
    )
    .await
    .map_err(err)?;
    Ok(value.unchecked_into())
}

pub async fn kv_get(db: &IdbDatabase, key: &str) -> Result<Option<String>, String> {
    let tx = db.transaction_with_str("kv").map_err(err)?;
    let request = tx
        .object_store("kv")
        .map_err(err)?
        .get(&key.into())
        .map_err(err)?;
    let value = super::promise::bounded(
        settle(&request),
        15,
        "Local storage did not answer. Reload to try again.",
        || {},
    )
    .await
    .map_err(err)?;
    Ok(value.as_string())
}

pub async fn kv_put(db: &IdbDatabase, key: &str, value: &str) -> Result<(), String> {
    kv_commit(db, &[(key.to_owned(), Some(value.to_owned()))]).await
}

/// Writes events as `{id, created_at, raw}` rows in one committed transaction.
pub async fn put_events(db: &IdbDatabase, rows: &[(String, u64, String)]) -> Result<(), String> {
    super::idb_commit::commit(db, "events", |tx| {
        let store = tx.object_store("events")?;
        for (id, created_at, raw) in rows {
            let row = Object::new();
            Reflect::set(&row, &"id".into(), &id.into())?;
            Reflect::set(&row, &"created_at".into(), &(*created_at as f64).into())?;
            Reflect::set(&row, &"raw".into(), &raw.into())?;
            store.put(&row)?;
        }
        Ok(())
    })
    .await
}

/// Raw JSON of the newest `limit` events, newest first.
pub async fn newest_events(db: &IdbDatabase, limit: usize) -> Result<Vec<String>, String> {
    let tx = db.transaction_with_str("events").map_err(err)?;
    let index = tx
        .object_store("events")
        .map_err(err)?
        .index("created_at")
        .map_err(err)?;
    let request = index
        .open_cursor_with_range_and_direction(&JsValue::NULL, IdbCursorDirection::Prev)
        .map_err(err)?;
    let rows = Rc::new(RefCell::new(Vec::new()));
    let slot: Rc<RefCell<Option<Step>>> = Rc::default();
    let done = Promise::new(&mut |resolve, reject| {
        let rows = rows.clone();
        let cursor_request = request.clone();
        let release = slot.clone();
        let step = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let cursor = cursor_request.result().unwrap_or(JsValue::NULL);
            if cursor.is_null() || rows.borrow().len() >= limit {
                let _ = resolve.call0(&JsValue::NULL);
                release.borrow_mut().take();
                return;
            }
            let cursor: web_sys::IdbCursorWithValue = cursor.unchecked_into();
            let raw = cursor
                .value()
                .ok()
                .and_then(|row| Reflect::get(&row, &"raw".into()).ok())
                .and_then(|raw| raw.as_string());
            if let Some(raw) = raw {
                rows.borrow_mut().push(raw);
            }
            let _ = cursor.continue_();
        });
        request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
        let on_err = Closure::once_into_js(move |_: web_sys::Event| {
            let _ = reject.call1(&JsValue::NULL, &"cursor failed".into());
        });
        request.set_onerror(Some(on_err.unchecked_ref()));
        *slot.borrow_mut() = Some(step);
    });
    let result = super::promise::bounded(
        done,
        15,
        "Local cache did not answer. Reload to try again.",
        || {},
    )
    .await;
    request.set_onsuccess(None);
    slot.borrow_mut().take();
    result.map_err(err)?;
    let out = rows.borrow().clone();
    Ok(out)
}

/// Deletes the `count` oldest event rows (by `created_at`).
pub async fn delete_oldest(db: &IdbDatabase, count: u32) -> Result<(), String> {
    let mut handler = None;
    let mut cursor_request = None;
    let result = super::idb_commit::commit(db, "events", |tx| {
        let request = tx
            .object_store("events")?
            .index("created_at")?
            .open_cursor()?;
        let cursor = request.clone();
        let tx = tx.clone();
        let mut left = count;
        let step = Step::new(move |_| {
            let advance = || -> Result<(), JsValue> {
                let value = cursor.result()?;
                if value.is_null() || left == 0 {
                    return Ok(());
                }
                let value: web_sys::IdbCursorWithValue = value.unchecked_into();
                value.delete()?;
                value.continue_()
            };
            if advance().is_err() {
                let _ = tx.abort();
            }
            left = left.saturating_sub(1);
        });
        request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
        cursor_request = Some(request);
        handler = Some(step);
        Ok(())
    })
    .await;
    if let Some(request) = cursor_request {
        request.set_onsuccess(None);
    }
    drop(handler);
    result
}

/// Total rows in the events store.
pub async fn count_events(db: &IdbDatabase) -> Result<u32, String> {
    let tx = db.transaction_with_str("events").map_err(err)?;
    let request = tx
        .object_store("events")
        .map_err(err)?
        .count()
        .map_err(err)?;
    let value = super::promise::bounded(
        settle(&request),
        15,
        "Local storage did not answer. Reload to try again.",
        || {},
    )
    .await
    .map_err(err)?;
    Ok(value.as_f64().unwrap_or(0.0) as u32)
}
