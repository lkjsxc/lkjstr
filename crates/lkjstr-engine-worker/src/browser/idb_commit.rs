//! Resolve writes only when the transaction commits; release every handler.
use js_sys::Promise;
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbDatabase, IdbTransaction, IdbTransactionMode};

pub(super) async fn commit(
    db: &IdbDatabase,
    store: &str,
    write: impl FnOnce(&IdbTransaction) -> Result<(), JsValue>,
) -> Result<(), String> {
    commit_stores(db, &[store], write).await
}

pub(super) async fn commit_stores(
    db: &IdbDatabase,
    stores: &[&str],
    write: impl FnOnce(&IdbTransaction) -> Result<(), JsValue>,
) -> Result<(), String> {
    let names = js_sys::Array::new();
    for store in stores {
        names.push(&(*store).into());
    }
    let tx = db
        .transaction_with_str_sequence_and_mode(&names, IdbTransactionMode::Readwrite)
        .map_err(|_| "Cannot start storage transaction")?;
    let mut handlers = Vec::new();
    let done = Promise::new(&mut |resolve, reject| {
        let complete = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let _ = resolve.call0(&JsValue::NULL);
        });
        let abort = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let _ = reject.call1(&JsValue::NULL, &"Storage transaction aborted".into());
        });
        tx.set_oncomplete(Some(complete.as_ref().unchecked_ref()));
        tx.set_onabort(Some(abort.as_ref().unchecked_ref()));
        handlers.extend([complete, abort]);
    });
    let writes = write(&tx);
    if writes.is_err() {
        let _ = tx.abort();
    }
    let abort_tx = tx.clone();
    let committed = super::promise::bounded(
        done,
        15,
        "Storage transaction did not answer. Try again.",
        move || {
            let _ = abort_tx.abort();
        },
    )
    .await;
    tx.set_oncomplete(None);
    tx.set_onabort(None);
    drop(handlers);
    if writes.is_err() || committed.is_err() {
        return Err("Storage transaction failed".into());
    }
    Ok(())
}

pub async fn kv_commit(db: &IdbDatabase, rows: &[(String, Option<String>)]) -> Result<(), String> {
    commit(db, "kv", |tx| {
        let store = tx.object_store("kv")?;
        for (key, value) in rows {
            match value {
                Some(value) => {
                    store.put_with_key(&value.into(), &key.into())?;
                }
                None => {
                    store.delete(&key.into())?;
                }
            }
        }
        Ok(())
    })
    .await
}
