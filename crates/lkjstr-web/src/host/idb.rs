//! IndexedDB: an `events` store (newest-first reload) and a `kv` store for
//! workspace, accounts, settings and relay scores. One database, no worker.

use std::cell::RefCell;
use std::rc::Rc;

use js_sys::{Object, Promise, Reflect};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use wasm_bindgen_futures::JsFuture;
use web_sys::{IdbCursorDirection, IdbDatabase, IdbRequest, IdbTransactionMode};

const DB_NAME: &str = "lkjstr";

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
    let value = JsFuture::from(settle(&request)).await.map_err(err)?;
    Ok(value.unchecked_into())
}

pub async fn kv_get(db: &IdbDatabase, key: &str) -> Result<Option<String>, String> {
    let tx = db.transaction_with_str("kv").map_err(err)?;
    let request = tx
        .object_store("kv")
        .map_err(err)?
        .get(&key.into())
        .map_err(err)?;
    let value = JsFuture::from(settle(&request)).await.map_err(err)?;
    Ok(value.as_string())
}

pub fn kv_put(db: &IdbDatabase, key: &str, value: &str) -> Result<(), String> {
    let tx = db
        .transaction_with_str_and_mode("kv", IdbTransactionMode::Readwrite)
        .map_err(err)?;
    let store = tx.object_store("kv").map_err(err)?;
    store
        .put_with_key(&value.into(), &key.into())
        .map_err(err)?;
    Ok(())
}

pub fn kv_delete(db: &IdbDatabase, key: &str) -> Result<(), String> {
    let tx = db
        .transaction_with_str_and_mode("kv", IdbTransactionMode::Readwrite)
        .map_err(err)?;
    tx.object_store("kv")
        .map_err(err)?
        .delete(&key.into())
        .map_err(err)?;
    Ok(())
}

/// Writes events as `{id, created_at, raw}` rows in one transaction.
pub fn put_events(db: &IdbDatabase, rows: &[(String, u64, String)]) -> Result<(), String> {
    let tx = db
        .transaction_with_str_and_mode("events", IdbTransactionMode::Readwrite)
        .map_err(err)?;
    let store = tx.object_store("events").map_err(err)?;
    for (id, created_at, raw) in rows {
        let row = Object::new();
        let _ = Reflect::set(&row, &"id".into(), &id.into());
        let _ = Reflect::set(&row, &"created_at".into(), &(*created_at as f64).into());
        let _ = Reflect::set(&row, &"raw".into(), &raw.into());
        store.put(&row).map_err(err)?;
    }
    Ok(())
}

pub fn delete_events(db: &IdbDatabase, ids: &[String]) -> Result<(), String> {
    let tx = db
        .transaction_with_str_and_mode("events", IdbTransactionMode::Readwrite)
        .map_err(err)?;
    let store = tx.object_store("events").map_err(err)?;
    for id in ids {
        store.delete(&id.into()).map_err(err)?;
    }
    Ok(())
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
    JsFuture::from(done).await.map_err(err)?;
    let out = rows.borrow().clone();
    Ok(out)
}

/// Total rows in the events store.
pub async fn count_events(db: &IdbDatabase) -> Result<u32, String> {
    let tx = db.transaction_with_str("events").map_err(err)?;
    let request = tx
        .object_store("events")
        .map_err(err)?
        .count()
        .map_err(err)?;
    let value = JsFuture::from(settle(&request)).await.map_err(err)?;
    Ok(value.as_f64().unwrap_or(0.0) as u32)
}
