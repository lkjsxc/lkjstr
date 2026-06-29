use std::rc::Rc;

use lkjstr_storage::{StorageOperation, StorageOutcome};
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use web_sys::{Event, MessageEvent};

use crate::storage_worker::outcome::{local_response, problem};
use crate::storage_worker::runtime::{ClientInner, PendingRequest};
use crate::storage_worker::{StorageOp, StorageRequest, StorageResponse, WorkerOutcome};

impl ClientInner {
    pub(super) fn promise_for(self: &Rc<Self>, request: &StorageRequest) -> js_sys::Promise {
        let request_id = request.request_id.clone();
        let deadline = clamp_deadline(request.deadline_ms);
        let inner = self.clone();
        js_sys::Promise::new(&mut move |resolve, _reject| {
            let timer = inner.install_timeout(&request_id, deadline, &resolve);
            inner.pending.borrow_mut().insert(
                request_id.clone(),
                PendingRequest {
                    resolve,
                    timer: timer.0,
                    _timer_callback: timer.1,
                },
            );
        })
    }

    pub(super) fn cancel_request(&self, request_id: &str) -> StorageOutcome<()> {
        if let Some(entry) = self.remove_pending(request_id) {
            resolve_response(
                &entry.resolve,
                &local_response(request_id, WorkerOutcome::Canceled),
            );
        }
        self.post_cancel(request_id)
    }

    pub(super) fn finish_all(&self, outcome: WorkerOutcome) {
        let mut pending = self.pending.borrow_mut();
        let entries = std::mem::take(&mut *pending);
        drop(pending);
        for (request_id, entry) in entries {
            clear_timeout(entry.timer);
            resolve_response(&entry.resolve, &local_response(&request_id, outcome));
        }
    }

    pub(super) fn shutdown(&self) {
        self.clear_handlers();
        self.worker.terminate();
        self.release_owner_lease();
    }

    pub(super) fn install_handlers(self: &Rc<Self>) {
        let message = message_callback(self.clone());
        self.worker
            .set_onmessage(Some(message.as_ref().unchecked_ref()));
        *self.on_message.borrow_mut() = Some(message);

        let error = error_callback(self.clone());
        self.worker
            .set_onerror(Some(error.as_ref().unchecked_ref()));
        self.worker
            .set_onmessageerror(Some(error.as_ref().unchecked_ref()));
        *self.on_error.borrow_mut() = Some(error);
    }

    fn install_timeout(
        self: &Rc<Self>,
        request_id: &str,
        deadline_ms: i32,
        resolve: &js_sys::Function,
    ) -> (i32, Closure<dyn FnMut()>) {
        let inner = self.clone();
        let request_id = request_id.to_owned();
        let resolve = resolve.clone();
        let callback = Closure::wrap(Box::new(move || {
            if inner.remove_pending(&request_id).is_some() {
                let _outcome = inner.post_cancel(&request_id);
                resolve_response(
                    &resolve,
                    &local_response(&request_id, WorkerOutcome::Timeout),
                );
            }
        }) as Box<dyn FnMut()>);
        let timer = timeout_handle(&callback, deadline_ms);
        (timer, callback)
    }

    fn handle_message(&self, value: JsValue) {
        let Ok(response) = serde_wasm_bindgen::from_value::<StorageResponse>(value) else {
            self.late_rejected
                .set(self.late_rejected.get().saturating_add(1));
            return;
        };
        if let Some(entry) = self.remove_pending(&response.request_id) {
            resolve_response(&entry.resolve, &response);
        } else {
            self.late_settled
                .set(self.late_settled.get().saturating_add(1));
        }
    }

    fn post_cancel(&self, target_request_id: &str) -> StorageOutcome<()> {
        let request = self.request_for(
            StorageOp::Cancel {
                target_request_id: target_request_id.to_owned(),
            },
            1_000,
        );
        match self.post_request(&request) {
            Ok(()) => StorageOutcome::Ok(()),
            Err(_error) => StorageOutcome::Unavailable(problem(
                StorageOperation::Transaction,
                "unavailable",
                request.request_id,
            )),
        }
    }

    fn remove_pending(&self, request_id: &str) -> Option<PendingRequest> {
        let entry = self.pending.borrow_mut().remove(request_id)?;
        clear_timeout(entry.timer);
        Some(entry)
    }

    fn release_owner_lease(&self) {
        if let Some(lease) = self.owner_lease.borrow_mut().take() {
            lease.release();
        }
    }

    fn clear_handlers(&self) {
        self.worker.set_onmessage(None);
        self.worker.set_onerror(None);
        self.worker.set_onmessageerror(None);
        self.on_message.borrow_mut().take();
        self.on_error.borrow_mut().take();
    }
}

impl Drop for ClientInner {
    fn drop(&mut self) {
        self.clear_handlers();
        self.worker.terminate();
        self.release_owner_lease();
    }
}

fn message_callback(inner: Rc<ClientInner>) -> Closure<dyn FnMut(MessageEvent)> {
    Closure::wrap(Box::new(move |event: MessageEvent| {
        inner.handle_message(event.data());
    }) as Box<dyn FnMut(_)>)
}

fn error_callback(inner: Rc<ClientInner>) -> Closure<dyn FnMut(Event)> {
    Closure::wrap(Box::new(move |_event: Event| {
        inner
            .late_rejected
            .set(inner.late_rejected.get().saturating_add(1));
        inner.finish_all(WorkerOutcome::Unavailable);
    }) as Box<dyn FnMut(_)>)
}

fn timeout_handle(callback: &Closure<dyn FnMut()>, deadline_ms: i32) -> i32 {
    web_sys::window()
        .and_then(|window| {
            window
                .set_timeout_with_callback_and_timeout_and_arguments_0(
                    callback.as_ref().unchecked_ref(),
                    deadline_ms,
                )
                .ok()
        })
        .unwrap_or(-1)
}

fn resolve_response(resolve: &js_sys::Function, response: &StorageResponse) {
    if let Ok(value) = serde_wasm_bindgen::to_value(response) {
        let _result = resolve.call1(&JsValue::NULL, &value);
    }
}

fn clear_timeout(timer: i32) {
    if timer >= 0
        && let Some(window) = web_sys::window()
    {
        window.clear_timeout_with_handle(timer);
    }
}

fn clamp_deadline(deadline_ms: u32) -> i32 {
    i32::try_from(deadline_ms).unwrap_or(i32::MAX).max(1)
}
