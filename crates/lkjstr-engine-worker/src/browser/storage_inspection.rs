//! Count only public event rows; estimate reports approximate origin totals.
//! Never enumerate `kv`, archives, keys, CacheStorage or event bodies.
use js_sys::{Promise, Reflect};
use lkjstr_core::engine::storage_inspection::{Count, MAX_SAFE, Origin};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};

/// Unlike the general timing helper, never fall back to a wall clock.
pub fn now() -> Option<u64> {
    let performance = Reflect::get(&js_sys::global(), &"performance".into()).ok()?;
    let method = Reflect::get(&performance, &"now".into())
        .ok()?
        .dyn_into::<js_sys::Function>()
        .ok()?;
    let value = method.call0(&performance).ok()?.as_f64()?;
    number(value.floor())
}
fn number(value: f64) -> Option<u64> {
    (value.is_finite() && value >= 0.0 && value <= MAX_SAFE as f64 && value.fract() == 0.0)
        .then_some(value as u64)
}
pub fn database_supported() -> Option<bool> {
    Reflect::get(&js_sys::global(), &"indexedDB".into())
        .ok()
        .map(|value| !value.is_null() && !value.is_undefined())
}
pub fn estimate() -> Result<Promise, Origin> {
    let navigator =
        Reflect::get(&js_sys::global(), &"navigator".into()).map_err(|_| Origin::Failed)?;
    if navigator.is_undefined() || navigator.is_null() {
        return Err(Origin::Unsupported);
    }
    let storage = Reflect::get(&navigator, &"storage".into()).map_err(|_| Origin::Failed)?;
    if storage.is_undefined() || storage.is_null() {
        return Err(Origin::Unsupported);
    }
    let method = Reflect::get(&storage, &"estimate".into()).map_err(|_| Origin::Failed)?;
    if method.is_undefined() || method.is_null() {
        return Err(Origin::Unsupported);
    }
    method
        .dyn_into::<js_sys::Function>()
        .map_err(|_| Origin::Failed)?
        .call0(&storage)
        .map_err(|_| Origin::Failed)?
        .dyn_into::<Promise>()
        .map_err(|_| Origin::Failed)
}
pub fn estimated(value: Result<JsValue, JsValue>, at: u64) -> Origin {
    let valid = || {
        let value = value.ok()?;
        let usage = number(Reflect::get(&value, &"usage".into()).ok()?.as_f64()?)?;
        let quota = number(Reflect::get(&value, &"quota".into()).ok()?.as_f64()?)?;
        Some(Origin::Ready {
            usage,
            quota,
            at,
            approximate: true,
        })
    };
    valid().unwrap_or(Origin::Failed)
}

/// Resolve only after a successful readonly transaction. `at` is the callback
/// observation time, not a claim that every component was measured together.
pub async fn count(db: &web_sys::IdbDatabase, ms: u32, signal: &web_sys::AbortSignal) -> Count {
    if signal.aborted() || ms == 0 {
        return Count::Failed;
    }
    let Ok(tx) = db.transaction_with_str("events") else {
        return Count::Failed;
    };
    let request = tx.object_store("events").and_then(|store| store.count());
    let Ok(request) = request else {
        let _ = tx.abort();
        return Count::Failed;
    };
    let observed = Rc::new(RefCell::new(None));
    let mut handlers = Vec::new();
    let done = Promise::new(&mut |resolve, reject| {
        let seen = observed.clone();
        let read = request.clone();
        let accepted = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            *seen.borrow_mut() = read
                .result()
                .ok()
                .and_then(|value| value.as_f64())
                .and_then(number);
        });
        let seen = observed.clone();
        let fail = reject.clone();
        let complete = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            if let (Some(count), Some(at)) = (*seen.borrow(), now()) {
                let pair = js_sys::Array::new();
                pair.push(&JsValue::from_f64(count as f64));
                pair.push(&JsValue::from_f64(at as f64));
                let _ = resolve.call1(&JsValue::NULL, &pair);
            } else {
                let _ = fail.call0(&JsValue::NULL);
            }
        });
        let aborted = Closure::<dyn FnMut(web_sys::Event)>::new(move |_| {
            let _ = reject.call0(&JsValue::NULL);
        });
        request.set_onsuccess(Some(accepted.as_ref().unchecked_ref()));
        tx.set_oncomplete(Some(complete.as_ref().unchecked_ref()));
        tx.set_onabort(Some(aborted.as_ref().unchecked_ref()));
        handlers.extend([accepted, complete, aborted]);
    });
    let abort_tx = tx.clone();
    let result = super::promise::bounded_ms_for(
        done,
        ms,
        "storage-deadline",
        move || {
            let _ = abort_tx.abort();
        },
        Some(signal),
    )
    .await;
    if result.is_err() {
        let _ = tx.abort();
    }
    request.set_onsuccess(None);
    tx.set_oncomplete(None);
    tx.set_onabort(None);
    drop(handlers);
    let ready = || {
        let value = result.ok()?;
        let pair = value.dyn_into::<js_sys::Array>().ok()?;
        Some(Count::Ready {
            count: number(pair.get(0).as_f64()?)?,
            at: number(pair.get(1).as_f64()?)?,
        })
    };
    ready().unwrap_or(Count::Failed)
}
