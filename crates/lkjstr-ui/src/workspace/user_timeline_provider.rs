use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::UserTimelineFeedView;

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct UserTimelineProvider {
    read: Arc<dyn Fn(UserTimelineRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct UserTimelineComplete {
    complete: Callback<UserTimelineFeedView>,
}

#[derive(Clone)]
pub struct UserTimelineLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct UserTimelineRequest {
    pub owner: String,
    pub target_pubkey: Option<String>,
    complete: UserTimelineComplete,
    lease: UserTimelineLease,
}

impl UserTimelineLease {
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

impl UserTimelineComplete {
    pub fn complete(&self, model: UserTimelineFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl UserTimelineRequest {
    pub fn complete(&self, model: UserTimelineFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> UserTimelineLease {
        self.lease.clone()
    }
}

impl UserTimelineProvider {
    #[must_use]
    pub fn new(read: impl Fn(UserTimelineRequest) + Send + Sync + 'static) -> Self {
        Self {
            read: Arc::new(read),
        }
    }

    pub fn read(
        &self,
        owner: String,
        target_pubkey: Option<String>,
        complete: Callback<UserTimelineFeedView>,
    ) -> UserTimelineLease {
        let lease = UserTimelineLease::new();
        (self.read)(UserTimelineRequest {
            owner,
            target_pubkey,
            complete: UserTimelineComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
