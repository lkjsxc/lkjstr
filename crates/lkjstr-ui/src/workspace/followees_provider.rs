use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::FolloweesView;

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct FolloweesProvider {
    read: Arc<dyn Fn(FolloweesRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct FolloweesComplete {
    complete: Callback<FolloweesView>,
}

#[derive(Clone)]
pub struct FolloweesLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct FolloweesRequest {
    pub owner: String,
    pub target_pubkey: Option<String>,
    complete: FolloweesComplete,
    lease: FolloweesLease,
}

impl FolloweesLease {
    #[must_use]
    fn new() -> Self {
        Self {
            state: LocalLease::new(),
        }
    }

    pub fn release(&self) {
        self.state.release();
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.state.is_released()
    }

    pub fn on_release(&self, cleanup: impl FnOnce() + Send + Sync + 'static) {
        self.state.on_release(cleanup);
    }
}

impl FolloweesComplete {
    pub fn complete(&self, model: FolloweesView) {
        let _unused = self.complete.try_run(model);
    }
}

impl FolloweesRequest {
    pub fn complete(&self, model: FolloweesView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn lease(&self) -> FolloweesLease {
        self.lease.clone()
    }
}

impl FolloweesProvider {
    #[must_use]
    pub fn new(read: impl Fn(FolloweesRequest) + Send + Sync + 'static) -> Self {
        Self {
            read: Arc::new(read),
        }
    }

    pub fn read(
        &self,
        owner: String,
        target_pubkey: Option<String>,
        complete: Callback<FolloweesView>,
    ) -> FolloweesLease {
        let lease = FolloweesLease::new();
        (self.read)(FolloweesRequest {
            owner,
            target_pubkey,
            complete: FolloweesComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
