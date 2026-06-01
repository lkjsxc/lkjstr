use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use std::rc::Rc;

use lkjstr_storage::{StorageOperation, StorageOutcome};
use wasm_bindgen::{closure::Closure, prelude::JsValue};
use web_sys::{Event, MessageEvent, Worker};

use crate::storage_worker::client::StorageWorkerClient;
use crate::storage_worker::outcome::{map_worker_response, problem};
use crate::storage_worker::{StorageOp, StorageRequest, StorageResponse};

type MessageCallback = Closure<dyn FnMut(MessageEvent)>;
type ErrorCallback = Closure<dyn FnMut(Event)>;
type MessageSlot = RefCell<Option<MessageCallback>>;
type ErrorSlot = RefCell<Option<ErrorCallback>>;

pub(super) struct ClientInner {
    pub(super) worker: Worker,
    pub(super) pending: RefCell<BTreeMap<String, PendingRequest>>,
    pub(super) next_id: Cell<u32>,
    pub(super) closed: Cell<bool>,
    pub(super) late_settled: Cell<u32>,
    pub(super) late_rejected: Cell<u32>,
    pub(super) on_message: MessageSlot,
    pub(super) on_error: ErrorSlot,
}

pub(super) struct PendingRequest {
    pub(super) resolve: js_sys::Function,
    pub(super) timer: i32,
    pub(super) _timer_callback: Closure<dyn FnMut()>,
}

pub(super) fn worker_client(
    result: Result<Worker, JsValue>,
) -> StorageOutcome<StorageWorkerClient> {
    match result {
        Ok(worker) => {
            let inner = Rc::new(ClientInner::new(worker));
            inner.install_handlers();
            StorageOutcome::Ok(StorageWorkerClient { inner })
        }
        Err(_error) => StorageOutcome::Unavailable(problem(
            StorageOperation::Transaction,
            "unavailable",
            "worker-open",
        )),
    }
}

pub(super) fn response_from_js(
    value: JsValue,
    op: StorageOperation,
) -> StorageOutcome<StorageResponse> {
    match serde_wasm_bindgen::from_value::<StorageResponse>(value) {
        Ok(response) => map_worker_response(response, op),
        Err(_error) => StorageOutcome::Corrupt(problem(op, "corrupt", "response-decode")),
    }
}

impl ClientInner {
    fn new(worker: Worker) -> Self {
        Self {
            worker,
            pending: RefCell::new(BTreeMap::new()),
            next_id: Cell::new(0),
            closed: Cell::new(false),
            late_settled: Cell::new(0),
            late_rejected: Cell::new(0),
            on_message: RefCell::new(None),
            on_error: RefCell::new(None),
        }
    }

    pub(super) fn closed(&self) -> bool {
        self.closed.get()
    }

    pub(super) fn mark_closed(&self) {
        self.closed.set(true);
    }

    pub(super) fn late_settled(&self) -> u32 {
        self.late_settled.get()
    }

    pub(super) fn late_rejected(&self) -> u32 {
        self.late_rejected.get()
    }

    pub(super) fn pending_count(&self) -> usize {
        self.pending.borrow().len()
    }

    pub(super) fn request_for(&self, op: StorageOp, deadline_ms: u32) -> StorageRequest {
        let next = self.next_id.get().saturating_add(1);
        self.next_id.set(next);
        StorageRequest {
            request_id: format!("sqlite-{next}"),
            deadline_ms,
            op,
        }
    }

    pub(super) fn post_request(&self, request: &StorageRequest) -> Result<(), JsValue> {
        let value = serde_wasm_bindgen::to_value(request)?;
        self.worker.post_message(&value)
    }
}
