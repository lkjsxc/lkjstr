//! Verified public rows and their metadata checkpoint share one transaction.
use super::{idb, idb_commit};
use js_sys::{Object, Reflect};
use lkjstr_core::cache::{self, Record};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbDatabase, IdbObjectStore};

pub(super) fn write(store: &IdbObjectStore, record: &Record) -> Result<(), JsValue> {
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
    store.put(&row)?;
    Ok(())
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
    let metadata: Vec<_> = rows
        .iter()
        .filter(|row| row.is_checkpoint())
        .cloned()
        .collect();
    let stores: &[&str] = if metadata.is_empty() {
        &["events"]
    } else {
        &["events", "kv"]
    };
    let mut cursor = None;
    let mut handler = None;
    let result = idb_commit::commit_stores(db, stores, |tx| {
        let events = tx.object_store("events")?;
        for row in rows {
            write(&events, row)?;
        }
        if metadata.is_empty() {
            return Ok(());
        }
        let kv = tx.object_store("kv")?;
        let request = kv.get(&cache::METADATA_KEY.into())?;
        let current = request.clone();
        let transaction = tx.clone();
        let metadata = metadata.clone();
        let access = access.clone();
        let step = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let save = || -> Result<(), JsValue> {
                let previous = current.result()?.as_string();
                let merged =
                    cache::merge_metadata_with_access(previous.as_deref(), &metadata, &access)
                        .map_err(|_| JsValue::from_str("metadata cache encoding failed"))?;
                kv.put_with_key(&merged.into(), &cache::METADATA_KEY.into())?;
                Ok(())
            };
            if save().is_err() {
                let _ = transaction.abort();
            }
        });
        request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
        cursor = Some(request);
        handler = Some(step);
        Ok(())
    })
    .await;
    if let Some(request) = cursor {
        request.set_onsuccess(None);
    }
    drop(handler);
    result
}

pub async fn metadata(db: &IdbDatabase) -> Result<Vec<Record>, String> {
    let raw = idb::kv_get(db, cache::METADATA_KEY).await?;
    cache::metadata_rows(raw.as_deref()).map_err(str::to_owned)
}
