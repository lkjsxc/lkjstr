//! Preserve account authority while returning to the schema-2 cache layout.
use lkjstr_core::{
    cache::METADATA_KEY,
    engine::account_storage::{self, Read, Revision},
};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbDatabase, IdbOpenDbRequest, IdbRequest};

type Handler = Closure<dyn FnMut(web_sys::Event)>;
const SCHEMA_3_RETENTION_KEY: &str = "durable-gdsf-v1";
pub(super) struct Upgrade {
    request: IdbRequest,
    _handler: Handler,
}
impl Drop for Upgrade {
    fn drop(&mut self) {
        self.request.set_onsuccess(None);
    }
}
fn create_events(db: &IdbDatabase) -> Result<(), JsValue> {
    let options = web_sys::IdbObjectStoreParameters::new();
    options.set_key_path(&"id".into());
    let events = db.create_object_store_with_optional_parameters("events", &options)?;
    events.create_index_with_str("created_at", "created_at")?;
    Ok(())
}

pub(super) fn begin(request: &IdbOpenDbRequest, old: f64) -> Result<Option<Upgrade>, JsValue> {
    let db = request.result()?.dyn_into::<IdbDatabase>()?;
    let tx = request.transaction().ok_or("missing upgrade transaction")?;
    if old == f64::from(account_storage::DATABASE_SCHEMA) {
        return Ok(None);
    }
    if old == 3.0 {
        // The account rows and all other KV records stay in place.
        db.delete_object_store("events")?;
        create_events(&db)?;
        let store = tx.object_store("kv")?;
        store.delete(&METADATA_KEY.into())?;
        store.delete(&SCHEMA_3_RETENTION_KEY.into())?;
        return Ok(None);
    }
    if old == 0.0 {
        create_events(&db)?;
        db.create_object_store("kv")?;
    } else if old != 1.0 {
        return Err("unsupported database schema".into());
    }
    // Existing rows and indexes are never replaced, copied or cleared.
    tx.object_store("events")?.index("created_at")?;
    let store = tx.object_store("kv")?;
    let accounts = super::idb_account_value::Record::read(&store, account_storage::ACCOUNTS_KEY)
        .map_err(|_| JsValue::from_str("account read failed"))?;
    let revision = super::idb_account_value::Record::read(&store, account_storage::REVISION_KEY)
        .map_err(|_| JsValue::from_str("revision read failed"))?;
    let current = revision.key.clone();
    let handler = Handler::new(move |_| {
        let result = (|| -> Result<(), JsValue> {
            let raw = accounts
                .text()
                .map_err(|_| JsValue::from_str("invalid account value"))?;
            let saved = revision
                .text()
                .map_err(|_| JsValue::from_str("invalid revision value"))?;
            let initial = Revision::INITIAL.encoded();
            let stamp = saved.as_deref().unwrap_or(&initial);
            account_storage::load(
                raw.as_deref().map_or(Read::Absent, Read::Text),
                Read::Text(stamp),
            )
            .map_err(|_| JsValue::from_str("invalid account storage"))?;
            if saved.is_none() {
                store.put_with_key(&initial.into(), &account_storage::REVISION_KEY.into())?;
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = tx.abort();
        }
    });
    current.set_onsuccess(Some(handler.as_ref().unchecked_ref()));
    Ok(Some(Upgrade {
        request: current,
        _handler: handler,
    }))
}
