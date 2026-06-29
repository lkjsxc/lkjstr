use std::cell::{Cell, RefCell};
use std::rc::Rc;

use lkjstr_storage::{StorageOperation, StorageOutcome};
use wasm_bindgen::{JsCast, closure::Closure, prelude::*};
use wasm_bindgen_futures::JsFuture;

use super::StorageOwnerLease;
use crate::storage_worker::outcome::problem;

const OWNER_LOCK_NAME: &str = "lkjstr.sqlite-opfs-owner";

type LockCallbackSlot = Rc<RefCell<Option<Closure<dyn FnMut(JsValue) -> JsValue>>>>;
type CatchCallbackSlot = Rc<RefCell<Option<Closure<dyn FnMut(JsValue)>>>>;

pub(super) async fn acquire_wasm_lease() -> StorageOutcome<StorageOwnerLease> {
    let promise = match owner_lock_promise() {
        Ok(promise) => promise,
        Err(reason) => return StorageOutcome::Blocked(owner_problem(reason)),
    };
    match JsFuture::from(promise).await {
        Ok(value) => lease_from_value(value),
        Err(_error) => StorageOutcome::Unavailable(owner_problem("worker-open-failed")),
    }
}

fn owner_lock_promise() -> Result<js_sys::Promise, &'static str> {
    let locks = lock_manager().ok_or("web-lock-unavailable")?;
    let request = function_prop(&locks, "request").ok_or("web-lock-unavailable")?;
    Ok(js_sys::Promise::new(&mut move |resolve, _reject| {
        request_owner_lock(&locks, &request, &resolve);
    }))
}

fn request_owner_lock(locks: &JsValue, request: &js_sys::Function, resolve: &js_sys::Function) {
    let release_slot: Rc<RefCell<Option<js_sys::Function>>> = Rc::new(RefCell::new(None));
    let callback_slot: LockCallbackSlot = Rc::new(RefCell::new(None));
    let catch_slot: CatchCallbackSlot = Rc::new(RefCell::new(None));
    let held = held_promise(release_slot.clone());
    let callback = owner_callback(
        resolve.clone(),
        held,
        release_slot,
        callback_slot.clone(),
        catch_slot.clone(),
    );
    let catch = owner_catch(resolve.clone(), callback_slot.clone(), catch_slot.clone());
    let callback_fn: js_sys::Function = callback
        .as_ref()
        .unchecked_ref::<js_sys::Function>()
        .clone();
    *callback_slot.borrow_mut() = Some(callback);
    *catch_slot.borrow_mut() = Some(catch);
    match request.call3(
        locks,
        &JsValue::from_str(OWNER_LOCK_NAME),
        &lock_options(),
        &callback_fn,
    ) {
        Ok(promise) => {
            let promise: js_sys::Promise = promise.unchecked_into();
            let catch_borrow = catch_slot.borrow();
            if let Some(catch) = catch_borrow.as_ref() {
                let _next = promise.catch(catch);
            }
        }
        Err(_error) => {
            callback_slot.borrow_mut().take();
            catch_slot.borrow_mut().take();
            resolve_owner(resolve, "unavailable", "worker-open-failed", None);
        }
    }
}

fn held_promise(release_slot: Rc<RefCell<Option<js_sys::Function>>>) -> js_sys::Promise {
    js_sys::Promise::new(&mut move |release, _reject| {
        *release_slot.borrow_mut() = Some(release);
    })
}

fn owner_callback(
    resolve: js_sys::Function,
    held: js_sys::Promise,
    release_slot: Rc<RefCell<Option<js_sys::Function>>>,
    callback_slot: LockCallbackSlot,
    catch_slot: CatchCallbackSlot,
) -> Closure<dyn FnMut(JsValue) -> JsValue> {
    Closure::wrap(Box::new(move |lock: JsValue| {
        let result = if lock.is_null() || lock.is_undefined() {
            resolve_owner(&resolve, "busy", "web-lock-held", None);
            JsValue::UNDEFINED
        } else {
            let release = release_slot.borrow().as_ref().cloned();
            resolve_owner(&resolve, "active", "web-lock-granted", release.as_ref());
            held.clone().into()
        };
        callback_slot.borrow_mut().take();
        catch_slot.borrow_mut().take();
        result
    }) as Box<dyn FnMut(JsValue) -> JsValue>)
}

fn owner_catch(
    resolve: js_sys::Function,
    callback_slot: LockCallbackSlot,
    catch_slot: CatchCallbackSlot,
) -> Closure<dyn FnMut(JsValue)> {
    Closure::wrap(Box::new(move |_error: JsValue| {
        callback_slot.borrow_mut().take();
        catch_slot.borrow_mut().take();
        resolve_owner(&resolve, "unavailable", "worker-open-failed", None);
    }) as Box<dyn FnMut(JsValue)>)
}

fn resolve_owner(
    resolve: &js_sys::Function,
    state: &str,
    reason: &str,
    release: Option<&js_sys::Function>,
) {
    let object = owner_result(state, reason, release);
    let _result = resolve.call1(&JsValue::NULL, &object);
}

fn owner_result(state: &str, reason: &str, release: Option<&js_sys::Function>) -> JsValue {
    let object = js_sys::Object::new();
    set_prop(&object, "state", &JsValue::from_str(state));
    set_prop(&object, "reason", &JsValue::from_str(reason));
    if let Some(release) = release {
        set_prop(&object, "release", release);
    }
    object.into()
}

fn lock_options() -> JsValue {
    let object = js_sys::Object::new();
    set_prop(&object, "mode", &JsValue::from_str("exclusive"));
    set_prop(&object, "ifAvailable", &JsValue::TRUE);
    object.into()
}

fn set_prop(object: &js_sys::Object, name: &str, value: &JsValue) {
    let _result = js_sys::Reflect::set(object, &JsValue::from_str(name), value);
}

fn lease_from_value(value: JsValue) -> StorageOutcome<StorageOwnerLease> {
    let state = string_prop(&value, "state");
    let reason = string_prop(&value, "reason");
    match state.as_deref() {
        Some("active") => release_prop(&value).map_or_else(
            || StorageOutcome::Unavailable(owner_problem("worker-open-failed")),
            |release| {
                StorageOutcome::Ok(StorageOwnerLease {
                    release,
                    released: Cell::new(false),
                })
            },
        ),
        Some("busy") => StorageOutcome::Busy(owner_problem(owner_reason(reason.as_deref()))),
        _ => StorageOutcome::Blocked(owner_problem(owner_reason(reason.as_deref()))),
    }
}

fn lock_manager() -> Option<JsValue> {
    let navigator = js_sys::Reflect::get(&js_sys::global(), &JsValue::from_str("navigator")).ok()?;
    let locks = js_sys::Reflect::get(&navigator, &JsValue::from_str("locks")).ok()?;
    (!locks.is_null() && !locks.is_undefined()).then_some(locks)
}

fn function_prop(value: &JsValue, name: &str) -> Option<js_sys::Function> {
    js_sys::Reflect::get(value, &JsValue::from_str(name))
        .ok()?
        .dyn_into::<js_sys::Function>()
        .ok()
}

fn release_prop(value: &JsValue) -> Option<js_sys::Function> {
    function_prop(value, "release")
}

fn string_prop(value: &JsValue, name: &str) -> Option<String> {
    js_sys::Reflect::get(value, &JsValue::from_str(name))
        .ok()?
        .as_string()
}

fn owner_reason(reason: Option<&str>) -> &'static str {
    match reason {
        Some("web-lock-held") => "opfs-owner-held",
        Some("web-lock-unavailable") => "web-lock-unavailable",
        _ => "worker-open-failed",
    }
}

fn owner_problem(reason: &'static str) -> lkjstr_storage::StorageProblem {
    problem(StorageOperation::Transaction, reason, "sqlite-owner-lease")
}
