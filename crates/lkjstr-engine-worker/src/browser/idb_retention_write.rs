//! Every public writer advances the same durable generation, including migration.
use super::idb_events;
use lkjstr_core::cache::{
    Record,
    durable::{self, Access, Hint, Observation, State},
};
use std::{cell::Cell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbRequest, IdbTransaction};
type Handler = Closure<dyn FnMut(web_sys::Event)>;
#[derive(Default)]
pub(crate) struct Writes {
    requests: Vec<IdbRequest>,
    handlers: Vec<Handler>,
}
impl Drop for Writes {
    fn drop(&mut self) {
        for request in &self.requests {
            request.set_onsuccess(None);
        }
    }
}
pub(crate) fn hint(value: &JsValue) -> Hint {
    js_sys::Reflect::get(value, &"keep".into())
        .ok()
        .and_then(|value| value.as_string())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}
pub(crate) fn write(
    tx: &IdbTransaction,
    rows: &[Record],
    access: &Access,
) -> Result<Writes, JsValue> {
    let mut result = Writes::default();
    let kv = tx.object_store("kv")?;
    let request = kv.get(&durable::KEY.into())?;
    let current = request.clone();
    let transaction = tx.clone();
    let clock = Rc::new(Cell::new(0));
    let inflation = clock.clone();
    let bytes = rows.iter().map(durable::charge).sum();
    let handler = Handler::new(move |_| {
        let update = || -> Result<(), JsValue> {
            let raw = current.result()?.as_string();
            let mut state = State::read(raw.as_deref());
            inflation.set(state.inflation);
            state.changed(bytes);
            let raw = serde_json::to_string(&state)
                .map_err(|_| JsValue::from_str("retention encoding failed"))?;
            kv.put_with_key(&raw.into(), &durable::KEY.into())?;
            Ok(())
        };
        if update().is_err() {
            let _ = transaction.abort();
        }
    });
    request.set_onsuccess(Some(handler.as_ref().unchecked_ref()));
    result.requests.push(request);
    result.handlers.push(handler);
    let events = tx.object_store("events")?;
    for row in rows {
        let request = events.get(&row.id.as_str().into())?;
        let current = request.clone();
        let events = events.clone();
        let row = row.clone();
        let clock = clock.clone();
        let observed = access.events.get(&row.id).copied().unwrap_or(Observation {
            minute: access.minute,
            weight: 1,
            refetch: 1500,
        });
        let transaction = tx.clone();
        let handler = Handler::new(move |_| {
            let update = || -> Result<(), JsValue> {
                let mut keep = hint(&current.result()?);
                if observed.minute >= keep.observation.minute {
                    keep = Hint {
                        observation: observed,
                        inflation: clock.get(),
                    };
                }
                let value = idb_events::value(&row)?;
                let raw = serde_json::to_string(&keep)
                    .map_err(|_| JsValue::from_str("retention hint failed"))?;
                js_sys::Reflect::set(&value, &"keep".into(), &raw.into())?;
                events.put(&value)?;
                Ok(())
            };
            if update().is_err() {
                let _ = transaction.abort();
            }
        });
        request.set_onsuccess(Some(handler.as_ref().unchecked_ref()));
        result.requests.push(request);
        result.handlers.push(handler);
    }
    Ok(result)
}
