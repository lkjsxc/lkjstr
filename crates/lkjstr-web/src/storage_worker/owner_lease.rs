use std::cell::Cell;

use lkjstr_storage::StorageOutcome;

#[cfg(not(target_arch = "wasm32"))]
use lkjstr_storage::StorageOperation;

#[cfg(not(target_arch = "wasm32"))]
use crate::storage_worker::outcome::problem;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::JsValue;

#[cfg(target_arch = "wasm32")]
mod web_lock;

pub(super) struct StorageOwnerLease {
    #[cfg(target_arch = "wasm32")]
    release: js_sys::Function,
    released: Cell<bool>,
}

pub(super) async fn acquire_persistent_owner_lease() -> StorageOutcome<StorageOwnerLease> {
    #[cfg(target_arch = "wasm32")]
    {
        web_lock::acquire_wasm_lease().await
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        StorageOutcome::Blocked(problem(
            StorageOperation::Transaction,
            "web-lock-unavailable",
            "sqlite-owner-lease",
        ))
    }
}

impl StorageOwnerLease {
    pub(super) fn release(&self) {
        if self.released.replace(true) {
            return;
        }
        #[cfg(target_arch = "wasm32")]
        {
            let _result = self.release.call0(&JsValue::NULL);
        }
    }
}

impl Drop for StorageOwnerLease {
    fn drop(&mut self) {
        self.release();
    }
}
