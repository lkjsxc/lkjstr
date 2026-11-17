//! Event rows, metadata fences and read contexts share one serialized transaction.
use super::{idb, idb_commit, idb_events};
use lkjstr_core::cache::{
    self, Record,
    context::{self, Context, Limits},
};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::IdbDatabase;

pub async fn read(db: &IdbDatabase) -> Result<Vec<Context>, String> {
    let raw = idb::kv_get(db, context::CONTEXT_KEY).await?;
    context::read_contexts(raw.as_deref()).map_err(str::to_owned)
}
fn string(value: JsValue) -> Result<Option<String>, JsValue> {
    if value.is_undefined() || value.is_null() {
        return Ok(None);
    }
    value
        .as_string()
        .map(Some)
        .ok_or_else(|| "Invalid public cache value".into())
}
pub async fn put(
    db: &IdbDatabase,
    rows: &[Record],
    contexts: &[Context],
) -> Result<Option<Vec<Context>>, String> {
    if contexts.is_empty() && !rows.iter().any(|row| row.kind == Some(5)) {
        return idb_events::put(db, rows).await.map(|()| None);
    }
    let seed = lkjstr_protocol::bytes_to_hex(&super::random_bytes::<32>().map_err(str::to_owned)?);
    let metadata: Vec<_> = rows
        .iter()
        .filter(|row| row.is_checkpoint())
        .cloned()
        .collect();
    let deletions: Vec<_> = rows
        .iter()
        .filter(|row| row.kind == Some(5))
        .cloned()
        .collect();
    let metadata = Rc::new(metadata);
    let deletions = Rc::new(deletions);
    let contexts = Rc::new(contexts.to_vec());
    let output = Rc::new(RefCell::new(None));
    let mut requests = Vec::new();
    let mut handlers = Vec::new();
    let result = idb_commit::commit_stores(db, &["events", "kv"], |tx| {
        let events = tx.object_store("events")?;
        for row in rows {
            idb_events::write(&events, row)?;
        }
        let kv = tx.object_store("kv")?;
        let metadata_request = kv.get(&cache::METADATA_KEY.into())?;
        let context_request = kv.get(&context::CONTEXT_KEY.into())?;
        let left = Rc::new(Cell::new(2_u8));
        for request in [&metadata_request, &context_request] {
            let metadata_request = metadata_request.clone();
            let context_request = context_request.clone();
            let metadata = metadata.clone();
            let deletions = deletions.clone();
            let contexts = contexts.clone();
            let kv = kv.clone();
            let tx = tx.clone();
            let left = left.clone();
            let output = output.clone();
            let seed = seed.clone();
            let handler = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
                left.set(left.get().saturating_sub(1));
                if left.get() != 0 {
                    return;
                }
                let write = || -> Result<(), JsValue> {
                    let old_metadata = metadata_request.result()?.as_string();
                    let merged_metadata = cache::merge_metadata(old_metadata.as_deref(), &metadata)
                        .map_err(|_| JsValue::from_str("Public metadata encoding failed"))?;
                    let mut fences =
                        cache::metadata_rows(Some(&merged_metadata)).map_err(JsValue::from_str)?;
                    fences.retain(|row| row.kind == Some(5));
                    fences.extend(deletions.iter().cloned());
                    let old_contexts = string(context_request.result()?)
                        .unwrap_or_else(|_| Some("invalid read context value".into()));
                    let merged = context::recover_contexts(
                        old_contexts.as_deref(),
                        &contexts,
                        &fences,
                        &seed,
                        Limits::default(),
                    )
                    .map_err(JsValue::from_str)?;
                    let next = context::read_contexts(Some(&merged)).map_err(JsValue::from_str)?;
                    if !metadata.is_empty() {
                        kv.put_with_key(&merged_metadata.into(), &cache::METADATA_KEY.into())?;
                    }
                    kv.put_with_key(&merged.into(), &context::CONTEXT_KEY.into())?;
                    *output.borrow_mut() = Some(next);
                    Ok(())
                };
                if write().is_err() {
                    let _ = tx.abort();
                }
            });
            request.set_onsuccess(Some(handler.as_ref().unchecked_ref()));
            requests.push(request.clone());
            handlers.push(handler);
        }
        Ok(())
    })
    .await;
    for request in requests {
        request.set_onsuccess(None);
    }
    drop(handlers);
    result?;
    let next = output
        .borrow_mut()
        .take()
        .ok_or("Read context commit did not complete")?;
    Ok(Some(next))
}
