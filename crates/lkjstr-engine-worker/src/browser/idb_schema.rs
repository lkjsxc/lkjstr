//! Non-destructive schema fence: validate the old account row and add only CAS metadata.
use lkjstr_core::engine::account_storage::{self, Read, Revision};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbOpenDbRequest, IdbRequest};

type Handler = Closure<dyn FnMut(web_sys::Event)>;
pub(super) struct Upgrade {
    request: IdbRequest,
    _handler: Handler,
}
impl Drop for Upgrade {
    fn drop(&mut self) {
        self.request.set_onsuccess(None);
    }
}
pub(super) fn begin(request: &IdbOpenDbRequest, old: f64) -> Result<Upgrade, JsValue> {
    let db = request.result()?.dyn_into::<web_sys::IdbDatabase>()?;
    let tx = request.transaction().ok_or("missing upgrade transaction")?;
    if old == 0.0 {
        let options = web_sys::IdbObjectStoreParameters::new();
        options.set_key_path(&"id".into());
        let events = db.create_object_store_with_optional_parameters("events", &options)?;
        events.create_index_with_str("created_at", "created_at")?;
        db.create_object_store("kv")?;
    } else if old != 1.0 && old != 2.0 {
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
            let stamp = match saved.as_deref() {
                Some(stamp) => stamp,
                None if old == 0.0 || old == 1.0 => &initial,
                None => return Err("missing account revision".into()),
            };
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
    Ok(Upgrade {
        request: current,
        _handler: handler,
    })
}
