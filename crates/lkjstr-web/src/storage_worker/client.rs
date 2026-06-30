use std::rc::Rc;

use lkjstr_storage::StorageOutcome;
use web_sys::{Worker, WorkerOptions, WorkerType};

#[cfg(target_arch = "wasm32")]
use crate::storage_worker::broker::BrokerClient;
use crate::storage_worker::client_lifecycle::{close_worker, storage_request};
use crate::storage_worker::outcome::{local_response, operation_for, problem};
use crate::storage_worker::owner_lease::acquire_persistent_owner_lease;
use crate::storage_worker::runtime::{ClientInner, worker_client, worker_client_with_lease};
use crate::storage_worker::{DEFAULT_WORKER_URL, StorageOp, StorageResponse, WorkerOutcome};

#[derive(Clone)]
pub struct StorageWorkerClient {
    pub(super) inner: StorageWorkerClientInner,
}

#[derive(Clone)]
pub(super) enum StorageWorkerClientInner {
    Worker(Rc<ClientInner>),
    #[cfg(target_arch = "wasm32")]
    Broker(Rc<BrokerClient>),
}

pub struct StorageWorkerRequest {
    pub(super) request_id: String,
    pub(super) op: lkjstr_storage::StorageOperation,
    pub(super) promise: js_sys::Promise,
    pub(super) client: StorageWorkerClient,
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
            outcome => return outcome.map(|_| unreachable!("owner lease mapped")),
        };
        let options = WorkerOptions::new();
        options.set_type(WorkerType::Module);
        worker_client_with_lease(Worker::new_with_options(url, &options), Some(lease))
    }

    pub async fn new_app_broker(url: &str, database_name: &str) -> StorageOutcome<Self> {
        #[cfg(target_arch = "wasm32")]
        {
            BrokerClient::new(url, database_name).map(|broker| Self {
                inner: StorageWorkerClientInner::Broker(Rc::new(broker)),
            })
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = (url, database_name);
            StorageOutcome::Blocked(problem(
                lkjstr_storage::StorageOperation::Transaction,
                "broker-unavailable",
                "sqlite-app-broker",
            ))
        }
    }

    pub fn request(&self, op: StorageOp, deadline_ms: u32) -> StorageOutcome<StorageWorkerRequest> {
        match &self.inner {
            StorageWorkerClientInner::Worker(inner) => self.worker_request(inner, op, deadline_ms),
            #[cfg(target_arch = "wasm32")]
            StorageWorkerClientInner::Broker(broker) => self.broker_request(broker, op, deadline_ms),
        }
    }

    pub async fn send(&self, op: StorageOp, deadline_ms: u32) -> StorageOutcome<StorageResponse> {
        match self.request(op, deadline_ms) {
            StorageOutcome::Ok(request) => request.response().await,
            error => error.map(|request| local_response(&request.request_id, WorkerOutcome::Ok)),
        }
    }

    pub async fn close(&self) -> StorageOutcome<()> {
        match &self.inner {
            StorageWorkerClientInner::Worker(inner) => close_worker(inner, self).await,
            #[cfg(target_arch = "wasm32")]
            StorageWorkerClientInner::Broker(broker) => broker.close(1_000).await,
        }
    }

    pub fn cancel_request(&self, request_id: &str) -> StorageOutcome<()> {
        match &self.inner {
            StorageWorkerClientInner::Worker(inner) => inner.cancel_request(request_id),
            #[cfg(target_arch = "wasm32")]
            StorageWorkerClientInner::Broker(broker) => broker.cancel_request(request_id),
        }
    }

    pub fn is_closed(&self) -> bool {
        match &self.inner {
            StorageWorkerClientInner::Worker(inner) => inner.closed(),
            #[cfg(target_arch = "wasm32")]
            StorageWorkerClientInner::Broker(broker) => broker.is_closed(),
        }
    }

    pub fn diagnostics(&self) -> StorageWorkerDiagnostics {
        match &self.inner {
            StorageWorkerClientInner::Worker(inner) => StorageWorkerDiagnostics {
                late_settled: inner.late_settled(),
                late_rejected: inner.late_rejected(),
                pending: inner.pending_count(),
            },
            #[cfg(target_arch = "wasm32")]
            StorageWorkerClientInner::Broker(_) => StorageWorkerDiagnostics {
                late_settled: 0,
                late_rejected: 0,
                pending: 0,
            },
        }
    }

    fn worker_request(
        &self,
        inner: &Rc<ClientInner>,
        op: StorageOp,
        deadline_ms: u32,
    ) -> StorageOutcome<StorageWorkerRequest> {
        if inner.closed() {
            return StorageOutcome::Canceled(problem(operation_for(&op), "canceled", "closed"));
        }
        let request = inner.request_for(op, deadline_ms);
        let op = operation_for(&request.op);
        let promise = inner.promise_for(&request);
        match inner.post_request(&request) {
            Ok(()) => StorageOutcome::Ok(storage_request(request.request_id, op, promise, self)),
            Err(_error) => StorageOutcome::Unavailable(problem(op, "unavailable", request.request_id)),
        }
    }

    #[cfg(target_arch = "wasm32")]
    fn broker_request(
        &self,
        broker: &Rc<BrokerClient>,
        op: StorageOp,
        deadline_ms: u32,
    ) -> StorageOutcome<StorageWorkerRequest> {
        let request = broker.request_for(op, deadline_ms);
        let op = operation_for(&request.op);
        broker
            .promise_for(&request)
            .map(|promise| storage_request(request.request_id, op, promise, self))
    }
}
