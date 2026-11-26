//! Verified public rows and their metadata checkpoint share one transaction.
use js_sys::{Object, Reflect};
use lkjstr_core::cache::{self, Record};
use wasm_bindgen::JsValue;
use web_sys::IdbDatabase;

pub(super) fn value(record: &Record) -> Result<Object, JsValue> {
    let row = Object::new();
    Reflect::set(&row, &"id".into(), &record.id.as_str().into())?;
    Reflect::set(
        &row,
        &"created_at".into(),
        &(record.created_at as f64).into(),
    )?;
    Reflect::set(&row, &"raw".into(), &record.raw.as_str().into())?;
    if let Some(kind) = record.kind {
        Reflect::set(&row, &"kind".into(), &(kind as f64).into())?;
    }
    if let Some(receipt) = &record.receipt {
        Reflect::set(&row, &"receipt".into(), &receipt.as_str().into())?;
    }
    Ok(row)
}

pub(super) fn read(row: JsValue) -> Option<Record> {
    let raw = Reflect::get(&row, &"raw".into()).ok()?.as_string()?;
    let text = |name: &str| Reflect::get(&row, &name.into()).ok()?.as_string();
    let number = |name: &str| {
        let value = Reflect::get(&row, &name.into()).ok()?.as_f64()?;
        (value.is_finite() && value >= 0.0 && value.fract() == 0.0).then_some(value as u64)
    };
    Some(Record {
        id: text("id").unwrap_or_default(),
        created_at: number("created_at").unwrap_or_default(),
        kind: number("kind"),
        raw,
        receipt: text("receipt"),
    })
}

pub async fn put(db: &IdbDatabase, rows: &[Record]) -> Result<(), String> {
    put_with_access(db, rows, &cache::MetadataAccess::default()).await
}

pub async fn put_with_access(
    db: &IdbDatabase,
    rows: &[Record],
    access: &cache::MetadataAccess,
) -> Result<(), String> {
    super::idb_contexts::put(db, rows, &[], access, &cache::durable::Access::default())
        .await
        .map(|_| ())
}

pub async fn metadata(db: &IdbDatabase) -> Result<Vec<Record>, String> {
    super::idb_metadata::read(db).await
}

/// Reverse bulk reads preserve the cursor's timestamp/primary-key order and cap.
/// Unsupported option dictionaries and malformed rows use the existing cursor.
pub(super) async fn newest(db: &IdbDatabase, limit: usize) -> Result<Option<Vec<Record>>, String> {
    if limit == 0 {
        return Ok(Some(Vec::new()));
    }
    let count = u32::try_from(limit).map_err(|_| "Invalid cache read limit")?;
    let tx = db
        .transaction_with_str("events")
        .map_err(|_| "Cache read transaction failed")?;
    let index = tx
        .object_store("events")
        .and_then(|store| store.index("created_at"))
        .map_err(|_| "Cache read index missing")?;
    // IndexedDB 3 getAll(queryOrOptions). Older engines reject the dictionary.
    let options = Object::new();
    Reflect::set(&options, &"count".into(), &count.into())
        .and_then(|_| Reflect::set(&options, &"direction".into(), &"prev".into()))
        .map_err(|_| "Cache read options failed")?;
    let request = match index.get_all_with_key(&options) {
        Ok(request) => request,
        Err(error)
            if Reflect::get(&error, &"name".into())
                .ok()
                .and_then(|name| name.as_string())
                .is_some_and(|name| matches!(name.as_str(), "DataError" | "TypeError")) =>
        {
            return Ok(None);
        }
        Err(_) => return Err("Cache bulk request failed".into()),
    };
    let value = super::promise::bounded(
        super::idb::settle(&request),
        15,
        "Local cache did not answer. Reload to try again.",
        move || {
            let _ = tx.abort();
        },
    )
    .await
    .map_err(|_| "Cache bulk read failed")?;
    if !js_sys::Array::is_array(&value) {
        return Err("Invalid cache bulk response".into());
    }
    // A malformed raw field must not silently consume one of the valid-row slots.
    Ok(js_sys::Array::from(&value).iter().map(read).collect())
}
