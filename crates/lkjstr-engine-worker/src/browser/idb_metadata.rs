//! Resolve every required receipt inside the caller's serialized transaction.
use super::{idb, idb_events};
use lkjstr_core::cache::{self, Record, Required};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbDatabase, IdbRequest, IdbTransaction};

type Handler = Closure<dyn FnMut(web_sys::Event)>;
type Done = Rc<dyn Fn(Option<String>, Vec<Record>) -> Result<(), JsValue>>;
#[derive(Default)]
pub(super) struct Reads {
    bytes: usize,
    requests: Vec<IdbRequest>,
    handlers: Vec<Handler>,
}
impl Drop for Reads {
    fn drop(&mut self) {
        for request in &self.requests {
            request.set_onsuccess(None);
        }
    }
}
pub(super) fn load(
    tx: &IdbTransaction,
    reads: &Rc<RefCell<Reads>>,
    done: Done,
) -> Result<(), JsValue> {
    let request = tx.object_store("kv")?.get(&cache::METADATA_KEY.into())?;
    let current = request.clone();
    let tx = tx.clone();
    let weak = Rc::downgrade(reads);
    let handler = Handler::new(move |_| {
        let run = || -> Result<(), JsValue> {
            let value = current.result()?;
            if !value.is_null() && !value.is_undefined() && value.as_string().is_none() {
                return Err("invalid metadata cache value".into());
            }
            let raw = value.as_string();
            let references =
                cache::metadata_references(raw.as_deref()).map_err(JsValue::from_str)?;
            let reads = weak.upgrade().ok_or("metadata reader released")?;
            resolve(
                &tx,
                &reads,
                Rc::new(raw),
                Rc::new(references),
                0,
                Rc::default(),
                done.clone(),
            )
        };
        if run().is_err() {
            let _ = tx.abort();
        }
    });
    request.set_onsuccess(Some(handler.as_ref().unchecked_ref()));
    reads.borrow_mut().requests.push(request);
    reads.borrow_mut().handlers.push(handler);
    Ok(())
}
fn resolve(
    tx: &IdbTransaction,
    reads: &Rc<RefCell<Reads>>,
    raw: Rc<Option<String>>,
    references: Rc<Vec<Required>>,
    index: usize,
    rows: Rc<RefCell<Vec<Record>>>,
    done: Done,
) -> Result<(), JsValue> {
    if index == references.len() {
        return done(
            raw.as_ref().clone(),
            std::mem::take(&mut *rows.borrow_mut()),
        );
    }
    let end = (index + 32).min(references.len());
    let left = Rc::new(std::cell::Cell::new(end - index));
    for reference in &references[index..end] {
        let request = tx
            .object_store("events")?
            .get(&reference.id.as_str().into())?;
        let current = request.clone();
        let transaction = tx.clone();
        let weak = Rc::downgrade(reads);
        let rows = rows.clone();
        let raw = raw.clone();
        let references = references.clone();
        let left = left.clone();
        let done = done.clone();
        let handler = Handler::new(move |_| {
            let run = || -> Result<(), JsValue> {
                let row = idb_events::read(current.result()?).ok_or("required evidence missing")?;
                let reads = weak.upgrade().ok_or("metadata reader released")?;
                {
                    let mut budget = reads.borrow_mut();
                    budget.bytes = budget.bytes.saturating_add(cache::durable::charge(&row));
                    if budget.bytes > cache::durable::LIMITS.bytes {
                        return Err("required evidence exceeds durable budget".into());
                    }
                }
                rows.borrow_mut().push(row);
                left.set(left.get().saturating_sub(1));
                if left.get() == 0 {
                    resolve(
                        &transaction,
                        &reads,
                        raw.clone(),
                        references.clone(),
                        end,
                        rows.clone(),
                        done.clone(),
                    )?;
                }
                Ok(())
            };
            if run().is_err() {
                let _ = transaction.abort();
            }
        });
        request.set_onsuccess(Some(handler.as_ref().unchecked_ref()));
        reads.borrow_mut().requests.push(request);
        reads.borrow_mut().handlers.push(handler);
    }
    Ok(())
}

pub async fn read(db: &IdbDatabase) -> Result<Vec<Record>, String> {
    // Ordinary warm startup keeps the existing single-value fast path.
    let raw = idb::kv_get(db, cache::METADATA_KEY).await?;
    if let Some(rows) = cache::metadata_inline(raw.as_deref()).map_err(str::to_owned)? {
        return Ok(rows);
    }
    let reads = Rc::new(RefCell::new(Reads::default()));
    let output = Rc::new(RefCell::new(None));
    let result = output.clone();
    super::idb_commit::commit_stores(db, &["events", "kv"], |tx| {
        load(
            tx,
            &reads,
            Rc::new(move |raw, rows| {
                let rows =
                    cache::resolve_metadata(raw.as_deref(), &rows).map_err(JsValue::from_str)?;
                *result.borrow_mut() = Some(rows);
                Ok(())
            }),
        )
    })
    .await?;
    output
        .borrow_mut()
        .take()
        .ok_or_else(|| "required metadata read incomplete".into())
}
