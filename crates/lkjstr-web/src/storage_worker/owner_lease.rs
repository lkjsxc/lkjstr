use std::cell::Cell;

use lkjstr_storage::{StorageOperation, StorageOutcome};

use crate::storage_worker::outcome::problem;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{JsCast, prelude::*};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen_futures::JsFuture;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(inline_js = "
export function acquireSqliteOpfsOwnerLock() {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) {
    return Promise.resolve({ state: 'unavailable', reason: 'web-lock-unavailable' });
  }
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let settled = false;
  const settle = (resolve, value) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };
  return new Promise((resolve) => {
    locks.request('lkjstr.sqlite-opfs-owner', { mode: 'exclusive', ifAvailable: true }, (lock) => {
      if (!lock) {
        settle(resolve, { state: 'busy', reason: 'web-lock-held' });
        return undefined;
      }
      settle(resolve, { state: 'active', reason: 'web-lock-granted', release });
      return held;
    }).catch(() => settle(resolve, { state: 'unavailable', reason: 'worker-open-failed' }));
  });
}
")]
extern "C" {
    #[wasm_bindgen(js_name = acquireSqliteOpfsOwnerLock)]
    fn acquire_owner_lock() -> js_sys::Promise;
}

pub(super) struct StorageOwnerLease {
    #[cfg(target_arch = "wasm32")]
    release: js_sys::Function,
    released: Cell<bool>,
}

pub(super) async fn acquire_persistent_owner_lease() -> StorageOutcome<StorageOwnerLease> {
    #[cfg(target_arch = "wasm32")]
    {
        acquire_wasm_lease().await
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

#[cfg(target_arch = "wasm32")]
async fn acquire_wasm_lease() -> StorageOutcome<StorageOwnerLease> {
    match JsFuture::from(acquire_owner_lock()).await {
        Ok(value) => lease_from_value(value),
        Err(_error) => StorageOutcome::Unavailable(problem(
            StorageOperation::Transaction,
            "worker-open-failed",
            "sqlite-owner-lease",
        )),
    }
}

#[cfg(target_arch = "wasm32")]
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

#[cfg(target_arch = "wasm32")]
fn release_prop(value: &JsValue) -> Option<js_sys::Function> {
    js_sys::Reflect::get(value, &JsValue::from_str("release"))
        .ok()?
        .dyn_into::<js_sys::Function>()
        .ok()
}

#[cfg(target_arch = "wasm32")]
fn string_prop(value: &JsValue, name: &str) -> Option<String> {
    js_sys::Reflect::get(value, &JsValue::from_str(name))
        .ok()?
        .as_string()
}

#[cfg(target_arch = "wasm32")]
fn owner_reason(reason: Option<&str>) -> &'static str {
    match reason {
        Some("web-lock-held") => "opfs-owner-held",
        Some("web-lock-unavailable") => "web-lock-unavailable",
        _ => "worker-open-failed",
    }
}

#[cfg(target_arch = "wasm32")]
fn owner_problem(reason: &'static str) -> lkjstr_storage::StorageProblem {
    problem(StorageOperation::Transaction, reason, "sqlite-owner-lease")
}
