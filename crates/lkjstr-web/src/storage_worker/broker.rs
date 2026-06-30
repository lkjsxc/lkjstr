use std::cell::Cell;

use lkjstr_storage::{StorageOperation, StorageOutcome};
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;

use crate::storage_worker::outcome::problem;
use crate::storage_worker::{StorageOp, StorageRequest};

const BROKER_GLOBAL: &str = "__lkjstrSqliteOpfsBroker";

pub(super) struct BrokerClient {
    broker: JsValue,
    send: js_sys::Function,
    close: js_sys::Function,
    closed: Cell<bool>,
    next_id: Cell<u32>,
}

impl BrokerClient {
    pub(super) fn new(worker_url: &str, database_name: &str) -> StorageOutcome<Self> {
        let broker = match global_broker() {
            StorageOutcome::Ok(value) => value,
            outcome => return map_error(outcome),
        };
        match require_prop(&broker, "workerUrl", worker_url) {
            StorageOutcome::Ok(()) => {}
            outcome => return map_error(outcome),
        }
        match require_prop(&broker, "databaseName", database_name) {
            StorageOutcome::Ok(()) => {}
            outcome => return map_error(outcome),
        }
        let send = match function_prop(&broker, "send") {
            StorageOutcome::Ok(value) => value,
            outcome => return map_error(outcome),
        };
        let close = match function_prop(&broker, "close") {
            StorageOutcome::Ok(value) => value,
            outcome => return map_error(outcome),
        };
        StorageOutcome::Ok(Self {
            broker,
            send,
            close,
            closed: Cell::new(false),
            next_id: Cell::new(0),
        })
    }

    pub(super) fn request_for(&self, op: StorageOp, deadline_ms: u32) -> StorageRequest {
        let next = self.next_id.get().saturating_add(1);
        self.next_id.set(next);
        StorageRequest {
            request_id: format!("sqlite-broker-{next}"),
            deadline_ms,
            op,
        }
    }

    pub(super) fn promise_for(&self, request: &StorageRequest) -> StorageOutcome<js_sys::Promise> {
        if self.closed.get() {
            return StorageOutcome::Canceled(problem(
                StorageOperation::Transaction,
                "canceled",
                request.request_id.clone(),
            ));
        }
        let op = match to_js(&request.op) {
            StorageOutcome::Ok(value) => value,
            outcome => return map_error(outcome),
        };
        let options = request_options(request.deadline_ms);
        self.send
            .call2(&self.broker, &op, &options)
            .ok()
            .and_then(|value| value.dyn_into::<js_sys::Promise>().ok())
            .map(StorageOutcome::Ok)
            .unwrap_or_else(|| unavailable("broker-send"))
    }

    pub(super) async fn close(&self, deadline_ms: u32) -> StorageOutcome<()> {
        if self.closed.replace(true) {
            return StorageOutcome::Ok(());
        }
        let value = JsValue::from_f64(f64::from(deadline_ms));
        let Some(promise) = self
            .close
            .call1(&self.broker, &value)
            .ok()
            .and_then(|value| value.dyn_into::<js_sys::Promise>().ok())
        else {
            return unavailable("broker-close");
        };
        JsFuture::from(promise)
            .await
            .map(|_| ())
            .map_err(|_| ())
            .map_or_else(|()| unavailable("broker-close"), StorageOutcome::Ok)
    }

    pub(super) fn cancel_request(&self, _request_id: &str) -> StorageOutcome<()> {
        StorageOutcome::Ok(())
    }

    pub(super) fn is_closed(&self) -> bool {
        self.closed.get()
    }
}

fn global_broker() -> StorageOutcome<JsValue> {
    let value = js_sys::Reflect::get(&js_sys::global(), &JsValue::from_str(BROKER_GLOBAL)).ok();
    match value.filter(|value| !value.is_null() && !value.is_undefined()) {
        Some(value) => StorageOutcome::Ok(value),
        None => unavailable("broker-missing"),
    }
}

fn require_prop(value: &JsValue, name: &str, expected: &str) -> StorageOutcome<()> {
    if string_prop(value, name).as_deref() == Some(expected) {
        return StorageOutcome::Ok(());
    }
    unavailable("broker-key-mismatch")
}

fn function_prop(value: &JsValue, name: &str) -> StorageOutcome<js_sys::Function> {
    js_sys::Reflect::get(value, &JsValue::from_str(name))
        .ok()
        .and_then(|value| value.dyn_into::<js_sys::Function>().ok())
        .map(StorageOutcome::Ok)
        .unwrap_or_else(|| unavailable("broker-function-missing"))
}

fn string_prop(value: &JsValue, name: &str) -> Option<String> {
    js_sys::Reflect::get(value, &JsValue::from_str(name))
        .ok()?
        .as_string()
}

fn request_options(deadline_ms: u32) -> JsValue {
    let options = js_sys::Object::new();
    let _result = js_sys::Reflect::set(
        &options,
        &JsValue::from_str("deadlineMs"),
        &JsValue::from_f64(f64::from(deadline_ms)),
    );
    options.into()
}

fn to_js(op: &StorageOp) -> StorageOutcome<JsValue> {
    serde_wasm_bindgen::to_value(op).map_or_else(
        |_| unavailable("broker-request-encode"),
        StorageOutcome::Ok,
    )
}

fn unavailable<T>(reason: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Unavailable(problem(
        StorageOperation::Transaction,
        reason,
        reason,
    ))
}

fn map_error<T, U>(outcome: StorageOutcome<T>) -> StorageOutcome<U> {
    outcome.map(|_| unreachable!("broker error mapped"))
}
