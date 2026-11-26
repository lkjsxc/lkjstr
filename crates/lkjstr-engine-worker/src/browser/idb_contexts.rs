//! Event bodies, required proofs, read contexts and retention generation commit together.
use super::{idb, idb_commit, idb_metadata, idb_retention};
use lkjstr_core::cache::{
    self, Record,
    context::{self, Context, Limits},
};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::JsValue;
use web_sys::IdbDatabase;

pub async fn read(db: &IdbDatabase) -> Result<Vec<Context>, String> {
    let raw = idb::kv_get(db, context::CONTEXT_KEY).await?;
    context::read_contexts(raw.as_deref()).map_err(str::to_owned)
}
pub async fn put(
    db: &IdbDatabase,
    rows: &[Record],
    contexts: &[Context],
    access: &cache::MetadataAccess,
    durable: &cache::durable::Access,
) -> Result<Option<Vec<Context>>, String> {
    let metadata: Vec<_> = rows
        .iter()
        .filter(|row| row.is_checkpoint())
        .cloned()
        .collect();
    let needs_context = !contexts.is_empty() || rows.iter().any(|row| row.kind == Some(5));
    let seed = if needs_context {
        lkjstr_protocol::bytes_to_hex(&super::random_bytes::<32>().map_err(str::to_owned)?)
    } else {
        String::new()
    };
    let contexts = contexts.to_vec();
    let access = access.clone();
    let reads = Rc::new(RefCell::new(idb_metadata::Reads::default()));
    let output = Rc::new(RefCell::new(None));
    let writes = Rc::new(RefCell::new(Vec::new()));
    let result = idb_commit::commit_stores(db, &["events", "kv"], |tx| {
        writes
            .borrow_mut()
            .push(idb_retention::write(tx, rows, durable)?);
        let kv = tx.object_store("kv")?;
        let context_request = needs_context
            .then(|| kv.get(&context::CONTEXT_KEY.into()))
            .transpose()?;
        let transaction = tx.clone();
        let writes = writes.clone();
        let durable = durable.clone();
        let output = output.clone();
        idb_metadata::load(
            tx,
            &reads,
            Rc::new(move |previous, resolved| {
                let merged =
                    cache::recover_metadata(previous.as_deref(), &resolved, &metadata, &access)
                        .map_err(|error| JsValue::from_str(&error.to_string()))?;
                // A checkpoint-only legacy body may already have left the events store.
                // Install every referenced body before publishing its reference.
                if !merged.required.is_empty() {
                    writes.borrow_mut().push(idb_retention::write(
                        &transaction,
                        &merged.required,
                        &durable,
                    )?);
                }
                if previous.as_deref() != Some(merged.encoded.as_str()) {
                    kv.put_with_key(&merged.encoded.as_str().into(), &cache::METADATA_KEY.into())?;
                }
                if let Some(request) = &context_request {
                    let value = request.result()?;
                    let old = value.as_string();
                    let fences = cache::resolve_metadata(Some(&merged.encoded), &merged.required)
                        .map_err(JsValue::from_str)?;
                    let fences: Vec<_> = fences
                        .into_iter()
                        .filter(|row| row.kind == Some(5))
                        .collect();
                    let merged = context::recover_contexts(
                        old.as_deref(),
                        &contexts,
                        &fences,
                        &seed,
                        Limits::default(),
                    )
                    .map_err(JsValue::from_str)?;
                    let next = context::read_contexts(Some(&merged)).map_err(JsValue::from_str)?;
                    kv.put_with_key(&merged.into(), &context::CONTEXT_KEY.into())?;
                    *output.borrow_mut() = Some(next);
                }
                Ok(())
            }),
        )
    })
    .await;
    drop(writes);
    drop(reads);
    result?;
    Ok(output.borrow_mut().take())
}
