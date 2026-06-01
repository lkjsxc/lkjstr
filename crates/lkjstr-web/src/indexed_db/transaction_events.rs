use std::cell::{Cell, RefCell};
use std::rc::Rc;

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{Event, IdbTransaction};

const TRANSACTION_TIMEOUT_MS: i32 = 15_000;

type EventCallback = Closure<dyn FnMut(Event)>;
type EventSlot = Rc<RefCell<Option<EventCallback>>>;
type TimerCallback = Closure<dyn FnMut()>;
type TimerSlot = Rc<RefCell<Option<TimerCallback>>>;

pub async fn transaction_result(transaction: IdbTransaction) -> Result<(), JsValue> {
    JsFuture::from(transaction_promise(transaction))
        .await
        .map(|_value| ())
}

fn transaction_promise(transaction: IdbTransaction) -> js_sys::Promise {
    js_sys::Promise::new(&mut move |resolve, reject| {
        let complete = slot();
        let error = slot();
        let timer = Rc::new(Cell::new(None));
        let timer_callback = Rc::new(RefCell::new(None));
        let settled = Rc::new(Cell::new(false));
        let timer_state = TimerState::new(timer, timer_callback);
        install_complete(
            &transaction,
            &resolve,
            complete.clone(),
            error.clone(),
            timer_state.clone(),
            settled.clone(),
        );
        install_reject(
            &transaction,
            &reject,
            complete.clone(),
            error.clone(),
            timer_state.clone(),
            settled.clone(),
        );
        install_timeout(&transaction, &reject, complete, error, timer_state, settled);
    })
}

#[derive(Clone)]
struct TimerState {
    handle: Rc<Cell<Option<i32>>>,
    callback: TimerSlot,
}

impl TimerState {
    fn new(handle: Rc<Cell<Option<i32>>>, callback: TimerSlot) -> Self {
        Self { handle, callback }
    }
}

fn install_complete(
    transaction: &IdbTransaction,
    resolve: &js_sys::Function,
    complete: EventSlot,
    error: EventSlot,
    timer: TimerState,
    settled: Rc<Cell<bool>>,
) {
    let transaction_for_callback = transaction.clone();
    let resolve = resolve.clone();
    let complete_for_callback = complete.clone();
    let callback = Closure::wrap(Box::new(move |_event: Event| {
        if mark_settled(&settled) {
            clear_transaction(&transaction_for_callback, &complete_for_callback, &error);
            clear_timeout(&timer);
            let _result = resolve.call0(&JsValue::NULL);
        }
    }) as Box<dyn FnMut(_)>);
    *complete.borrow_mut() = Some(callback);
    if let Some(callback) = complete.borrow().as_ref() {
        transaction.set_oncomplete(Some(callback.as_ref().unchecked_ref()));
    }
}

fn install_reject(
    transaction: &IdbTransaction,
    reject: &js_sys::Function,
    complete: EventSlot,
    error: EventSlot,
    timer: TimerState,
    settled: Rc<Cell<bool>>,
) {
    let transaction_for_callback = transaction.clone();
    let reject = reject.clone();
    let error_for_callback = error.clone();
    let callback = Closure::wrap(Box::new(move |_event: Event| {
        if mark_settled(&settled) {
            let value = transaction_error_value(&transaction_for_callback);
            clear_transaction(&transaction_for_callback, &complete, &error_for_callback);
            clear_timeout(&timer);
            let _result = reject.call1(&JsValue::NULL, &value);
        }
    }) as Box<dyn FnMut(_)>);
    *error.borrow_mut() = Some(callback);
    if let Some(callback) = error.borrow().as_ref() {
        transaction.set_onerror(Some(callback.as_ref().unchecked_ref()));
        transaction.set_onabort(Some(callback.as_ref().unchecked_ref()));
    }
}

fn install_timeout(
    transaction: &IdbTransaction,
    reject: &js_sys::Function,
    complete: EventSlot,
    error: EventSlot,
    timer: TimerState,
    settled: Rc<Cell<bool>>,
) {
    let Some(window) = web_sys::window() else {
        return;
    };
    let transaction = transaction.clone();
    let reject = reject.clone();
    let timer_for_callback = timer.callback.clone();
    let callback = Closure::wrap(Box::new(move || {
        if mark_settled(&settled) {
            let _result = transaction.abort();
            clear_transaction(&transaction, &complete, &error);
            timer_for_callback.borrow_mut().take();
            let _result = reject.call1(&JsValue::NULL, &JsValue::from_str("timeout"));
        }
    }) as Box<dyn FnMut()>);
    match window.set_timeout_with_callback_and_timeout_and_arguments_0(
        callback.as_ref().unchecked_ref(),
        TRANSACTION_TIMEOUT_MS,
    ) {
        Ok(handle) => {
            timer.handle.set(Some(handle));
            *timer.callback.borrow_mut() = Some(callback);
        }
        Err(_error) => {}
    }
}

fn slot() -> EventSlot {
    Rc::new(RefCell::new(None))
}

fn mark_settled(settled: &Cell<bool>) -> bool {
    if settled.get() {
        false
    } else {
        settled.set(true);
        true
    }
}

fn clear_transaction(transaction: &IdbTransaction, complete: &EventSlot, error: &EventSlot) {
    transaction.set_oncomplete(None);
    transaction.set_onerror(None);
    transaction.set_onabort(None);
    complete.borrow_mut().take();
    error.borrow_mut().take();
}

fn clear_timeout(timer: &TimerState) {
    if let Some(handle) = timer.handle.take()
        && let Some(window) = web_sys::window()
    {
        window.clear_timeout_with_handle(handle);
    }
    timer.callback.borrow_mut().take();
}

fn transaction_error_value(transaction: &IdbTransaction) -> JsValue {
    transaction
        .error()
        .map(|error| JsValue::from_str(&error.name()))
        .unwrap_or_else(|| JsValue::from_str("transaction-error"))
}
