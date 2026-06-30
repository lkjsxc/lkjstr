use std::rc::Rc;

use lkjstr_storage::{StorageOperation, StorageOutcome};
use wasm_bindgen_futures::JsFuture;

use crate::storage_worker::client::{StorageWorkerClient, StorageWorkerRequest};
use crate::storage_worker::outcome::problem;
use crate::storage_worker::runtime::{ClientInner, response_from_js};
use crate::storage_worker::{StorageOp, StorageResponse, WorkerOutcome};

pub(super) fn storage_request(
    request_id: String,
    op: StorageOperation,
    promise: js_sys::Promise,
    client: &StorageWorkerClient,
) -> StorageWorkerRequest {
    StorageWorkerRequest {
        request_id,
        op,
        promise,
        client: client.clone(),
    }
}

pub(super) async fn close_worker(
    inner: &Rc<ClientInner>,
    client: &StorageWorkerClient,
) -> StorageOutcome<()> {
    if inner.closed() {
        return StorageOutcome::Ok(());
    }
    let outcome = client.send(StorageOp::Close, 1_000).await.map(|_| ());
    inner.mark_closed();
    inner.finish_all(WorkerOutcome::Canceled);
    inner.shutdown();
    outcome
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
            Err(_error) => StorageOutcome::LateRejected(problem(
                self.op,
                "late-rejected",
                self.request_id,
            )),
        }
    }
}
