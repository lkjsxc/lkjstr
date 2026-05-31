use std::cell::RefCell;
use std::rc::Rc;

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{Event, IdbOpenDbRequest, IdbRequest};

pub(super) type EventCallback = Closure<dyn FnMut(Event)>;
pub(super) type EventSlot = Rc<RefCell<Option<EventCallback>>>;

pub fn event_slot(callback: EventCallback) -> EventSlot {
    Rc::new(RefCell::new(Some(callback)))
}

pub async fn request_value(request: IdbRequest) -> Result<JsValue, JsValue> {
    let promise = request_promise(request, None, None);
    JsFuture::from(promise).await
}

pub async fn open_request_value(
    request: IdbOpenDbRequest,
    upgrade: EventSlot,
) -> Result<JsValue, JsValue> {
    if let Some(callback) = upgrade.borrow().as_ref() {
        request.set_onupgradeneeded(Some(callback.as_ref().unchecked_ref()));
    }
    let idb_request: IdbRequest = request.clone().unchecked_into();
    let promise = request_promise(idb_request, Some(request), Some(upgrade));
    JsFuture::from(promise).await
}

fn request_promise(
    request: IdbRequest,
    open_request: Option<IdbOpenDbRequest>,
    upgrade: Option<EventSlot>,
) -> js_sys::Promise {
    js_sys::Promise::new(&mut move |resolve, reject| {
        let success = Rc::new(RefCell::new(None));
        let error = Rc::new(RefCell::new(None));
        let blocked = Rc::new(RefCell::new(None));
        install_success(
            &request,
            &resolve,
            success.clone(),
            error.clone(),
            blocked.clone(),
            upgrade.clone(),
            open_request.clone(),
        );
        install_error(
            &request,
            &reject,
            success.clone(),
            error.clone(),
            blocked.clone(),
            upgrade.clone(),
            open_request.clone(),
        );
        if let Some(open) = open_request.clone() {
            install_blocked(&open, &reject, success, error, blocked, upgrade.clone());
        }
    })
}

fn install_success(
    request: &IdbRequest,
    resolve: &js_sys::Function,
    success: EventSlot,
    error: EventSlot,
    blocked: EventSlot,
    upgrade: Option<EventSlot>,
    open_request: Option<IdbOpenDbRequest>,
) {
    let request_for_callback = request.clone();
    let resolve = resolve.clone();
    let success_for_callback = success.clone();
    let callback = Closure::wrap(Box::new(move |_event: Event| {
        let result = request_for_callback.result();
        clear_request(
            &request_for_callback,
            &success_for_callback,
            &error,
            &blocked,
        );
        clear_extra(&upgrade);
        clear_open_request(&open_request);
        match result {
            Ok(value) => {
                let _result = resolve.call1(&JsValue::NULL, &value);
            }
            Err(value) => {
                let _result = resolve.call1(&JsValue::NULL, &value);
            }
        }
    }) as Box<dyn FnMut(_)>);
    *success.borrow_mut() = Some(callback);
    if let Some(callback) = success.borrow().as_ref() {
        request.set_onsuccess(Some(callback.as_ref().unchecked_ref()));
    }
}

fn install_error(
    request: &IdbRequest,
    reject: &js_sys::Function,
    success: EventSlot,
    error: EventSlot,
    blocked: EventSlot,
    upgrade: Option<EventSlot>,
    open_request: Option<IdbOpenDbRequest>,
) {
    let request_for_callback = request.clone();
    let reject = reject.clone();
    let error_for_callback = error.clone();
    let callback = Closure::wrap(Box::new(move |_event: Event| {
        let value = request_error_value(&request_for_callback);
        clear_request(
            &request_for_callback,
            &success,
            &error_for_callback,
            &blocked,
        );
        clear_extra(&upgrade);
        clear_open_request(&open_request);
        let _result = reject.call1(&JsValue::NULL, &value);
    }) as Box<dyn FnMut(_)>);
    *error.borrow_mut() = Some(callback);
    if let Some(callback) = error.borrow().as_ref() {
        request.set_onerror(Some(callback.as_ref().unchecked_ref()));
    }
}

fn install_blocked(
    request: &IdbOpenDbRequest,
    reject: &js_sys::Function,
    success: EventSlot,
    error: EventSlot,
    blocked: EventSlot,
    upgrade: Option<EventSlot>,
) {
    let reject = reject.clone();
    let request_for_callback = request.clone();
    let idb_request: IdbRequest = request.clone().unchecked_into();
    let blocked_for_callback = blocked.clone();
    let callback = Closure::wrap(Box::new(move |_event: Event| {
        clear_request(&idb_request, &success, &error, &blocked_for_callback);
        clear_extra(&upgrade);
        request_for_callback.set_onupgradeneeded(None);
        request_for_callback.set_onblocked(None);
        let _result = reject.call1(&JsValue::NULL, &JsValue::from_str("blocked"));
    }) as Box<dyn FnMut(_)>);
    *blocked.borrow_mut() = Some(callback);
    if let Some(callback) = blocked.borrow().as_ref() {
        request.set_onblocked(Some(callback.as_ref().unchecked_ref()));
    }
}

fn clear_request(
    request: &IdbRequest,
    success: &EventSlot,
    error: &EventSlot,
    blocked: &EventSlot,
) {
    request.set_onsuccess(None);
    request.set_onerror(None);
    success.borrow_mut().take();
    error.borrow_mut().take();
    blocked.borrow_mut().take();
}

fn clear_extra(upgrade: &Option<EventSlot>) {
    if let Some(slot) = upgrade {
        slot.borrow_mut().take();
    }
}

fn clear_open_request(open_request: &Option<IdbOpenDbRequest>) {
    if let Some(request) = open_request {
        request.set_onupgradeneeded(None);
        request.set_onblocked(None);
    }
}

fn request_error_value(request: &IdbRequest) -> JsValue {
    match request.error() {
        Ok(Some(error)) => JsValue::from_str(&error.name()),
        Ok(None) | Err(_) => JsValue::from_str("indexeddb-error"),
    }
}
