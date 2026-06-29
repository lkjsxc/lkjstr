use std::rc::Rc;

use lkjstr_storage::StorageOutcome;
use wasm_bindgen_futures::JsFuture;
use web_sys::{Worker, WorkerOptions, WorkerType};

use crate::storage_worker::outcome::{local_response, operation_for, problem};
use crate::storage_worker::owner_lease::acquire_persistent_owner_lease;
use crate::storage_worker::runtime::{
    ClientInner, response_from_js, worker_client, worker_client_with_lease,
};
use crate::storage_worker::{DEFAULT_WORKER_URL, StorageOp, StorageResponse, WorkerOutcome};

#[derive(Clone)]
pub struct StorageWorkerClient {
    pub(super) inner: Rc<ClientInner>,
}

pub struct StorageWorkerRequest {
    request_id: String,
    op: lkjstr_storage::StorageOperation,
    promise: js_sys::Promise,
    client: StorageWorkerClient,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StorageWorkerDiagnostics {
    pub late_settled: u32,
    pub late_rejected: u32,
    pub pending: usize,
}

impl StorageWorkerClient {
    pub fn new_default() -> StorageOutcome<Self> {
        Self::new_module(DEFAULT_WORKER_URL)
    }

    pub fn new_classic(url: &str) -> StorageOutcome<Self> {
        worker_client(Worker::new(url))
    }

    pub fn new_module(url: &str) -> StorageOutcome<Self> {
        let options = WorkerOptions::new();
        options.set_type(WorkerType::Module);
        worker_client(Worker::new_with_options(url, &options))
    }

    pub async fn new_owned_module(url: &str) -> StorageOutcome<Self> {
        let lease = match acquire_persistent_owner_lease().await {
            StorageOutcome::Ok(lease) => lease,
            StorageOutcome::Unavailable(problem) => return StorageOutcome::Unavailable(problem),
            StorageOutcome::Timeout(problem) => return StorageOutcome::Timeout(problem),
            StorageOutcome::Busy(problem) => return StorageOutcome::Busy(problem),
            StorageOutcome::Blocked(problem) => return StorageOutcome::Blocked(problem),
            StorageOutcome::Quota(problem) => return StorageOutcome::Quota(problem),
            StorageOutcome::Corrupt(problem) => return StorageOutcome::Corrupt(problem),
            StorageOutcome::Canceled(problem) => return StorageOutcome::Canceled(problem),
            StorageOutcome::LateSettled(problem) => return StorageOutcome::LateSettled(problem),
            StorageOutcome::LateRejected(problem) => return StorageOutcome::LateRejected(problem),
        };
        let options = WorkerOptions::new();
        options.set_type(WorkerType::Module);
        worker_client_with_lease(Worker::new_with_options(url, &options), Some(lease))
    }

    pub fn request(&self, op: StorageOp, deadline_ms: u32) -> StorageOutcome<StorageWorkerRequest> {
        if self.inner.closed() {
            return StorageOutcome::Canceled(problem(operation_for(&op), "canceled", "closed"));
        }
        let request = self.inner.request_for(op, deadline_ms);
        let op = operation_for(&request.op);
        let promise = self.inner.promise_for(&request);
        match self.inner.post_request(&request) {
            Ok(()) => StorageOutcome::Ok(StorageWorkerRequest {
                request_id: request.request_id,
                op,
                promise,
                client: self.clone(),
            }),
            Err(_error) => {
                StorageOutcome::Unavailable(problem(op, "unavailable", request.request_id))
            }
        }
    }

    pub async fn send(&self, op: StorageOp, deadline_ms: u32) -> StorageOutcome<StorageResponse> {
        match self.request(op, deadline_ms) {
            StorageOutcome::Ok(request) => request.response().await,
            error => error.map(|request| local_response(&request.request_id, WorkerOutcome::Ok)),
        }
    }

    pub async fn close(&self) -> StorageOutcome<()> {
        if self.inner.closed() {
            return StorageOutcome::Ok(());
        }
        let outcome = self.send(StorageOp::Close, 1_000).await.map(|_response| ());
        self.inner.mark_closed();
        self.inner.finish_all(WorkerOutcome::Canceled);
        self.inner.shutdown();
        outcome
    }

    pub fn cancel_request(&self, request_id: &str) -> StorageOutcome<()> {
        self.inner.cancel_request(request_id)
    }

    pub fn is_closed(&self) -> bool {
        self.inner.closed()
    }

    pub fn diagnostics(&self) -> StorageWorkerDiagnostics {
        StorageWorkerDiagnostics {
            late_settled: self.inner.late_settled(),
            late_rejected: self.inner.late_rejected(),
            pending: self.inner.pending_count(),
        }
    }
}

impl StorageWorkerRequest {
    pub fn request_id(&self) -> &str {
        &self.request_id
    }

    pub fn cancel(&self) -> StorageOutcome<()> {
        self.client.cancel_request(&self.request_id)
    }

    pub async fn response(self) -> StorageOutcome<StorageResponse> {
        match JsFuture::from(self.promise).await {
            Ok(value) => response_from_js(value, self.op),
            Err(_error) => {
                StorageOutcome::LateRejected(problem(self.op, "late-rejected", self.request_id))
            }
        }
    }
}
