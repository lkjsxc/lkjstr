use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::CustomRequestFeedView;

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct CustomRequestProvider {
    run: Arc<dyn Fn(CustomRequestRunRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct CustomRequestComplete {
    complete: Callback<CustomRequestFeedView>,
}

#[derive(Clone)]
pub struct CustomRequestLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct CustomRequestRunRequest {
    pub owner: String,
    pub raw_json: String,
    complete: CustomRequestComplete,
    lease: CustomRequestLease,
}

impl CustomRequestLease {
    #[must_use]
    fn new() -> Self {
        Self {
            state: LocalLease::new(),
        }
    }

    pub fn release(&self) {
        self.state.release();
    }

    pub fn on_release(&self, cleanup: impl FnOnce() + Send + Sync + 'static) {
        self.state.on_release(cleanup);
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.state.is_released()
    }
}

impl CustomRequestComplete {
    pub fn complete(&self, view: CustomRequestFeedView) {
        let _unused = self.complete.try_run(view);
    }
}

impl CustomRequestRunRequest {
    pub fn complete(&self, view: CustomRequestFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(view);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> CustomRequestLease {
        self.lease.clone()
    }
}

impl CustomRequestProvider {
    #[must_use]
    pub fn new(run: impl Fn(CustomRequestRunRequest) + Send + Sync + 'static) -> Self {
        Self { run: Arc::new(run) }
    }

    pub fn run(
        &self,
        owner: String,
        raw_json: String,
        complete: Callback<CustomRequestFeedView>,
    ) -> CustomRequestLease {
        let lease = CustomRequestLease::new();
        (self.run)(CustomRequestRunRequest {
            owner,
            raw_json,
            complete: CustomRequestComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
