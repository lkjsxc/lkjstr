use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::{GlobalFeedView, GlobalOlderLoadTrigger};

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct GlobalFeedProvider {
    read: Arc<dyn Fn(GlobalFeedRequest) + Send + Sync>,
    load_older: Arc<dyn Fn(GlobalOlderRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct GlobalFeedComplete {
    complete: Callback<GlobalFeedView>,
}

#[derive(Clone)]
pub struct GlobalFeedLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct GlobalFeedRequest {
    pub owner: String,
    complete: GlobalFeedComplete,
    lease: GlobalFeedLease,
}

#[derive(Clone)]
pub struct GlobalOlderRequest {
    pub owner: String,
    pub trigger: GlobalOlderLoadTrigger,
    pub scrollable: bool,
    pub user_scrolled_down: bool,
    complete: GlobalFeedComplete,
    lease: GlobalFeedLease,
}

impl GlobalFeedLease {
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

impl GlobalFeedComplete {
    pub fn complete(&self, model: GlobalFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl GlobalFeedRequest {
    pub fn complete(&self, model: GlobalFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> GlobalFeedLease {
        self.lease.clone()
    }
}

impl GlobalOlderRequest {
    pub fn complete(&self, model: GlobalFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> GlobalFeedLease {
        self.lease.clone()
    }
}

impl GlobalFeedProvider {
    #[must_use]
    pub fn new(read: impl Fn(GlobalFeedRequest) + Send + Sync + 'static) -> Self {
        Self::with_older(read, |_| {})
    }

    #[must_use]
    pub fn with_older(
        read: impl Fn(GlobalFeedRequest) + Send + Sync + 'static,
        load_older: impl Fn(GlobalOlderRequest) + Send + Sync + 'static,
    ) -> Self {
        Self {
            read: Arc::new(read),
            load_older: Arc::new(load_older),
        }
    }

    pub fn read(&self, owner: String, complete: Callback<GlobalFeedView>) -> GlobalFeedLease {
        let lease = GlobalFeedLease::new();
        (self.read)(GlobalFeedRequest {
            owner,
            complete: GlobalFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }

    pub fn load_older(
        &self,
        owner: String,
        trigger: GlobalOlderLoadTrigger,
        scrollable: bool,
        user_scrolled_down: bool,
        complete: Callback<GlobalFeedView>,
    ) -> GlobalFeedLease {
        let lease = GlobalFeedLease::new();
        (self.load_older)(GlobalOlderRequest {
            owner,
            trigger,
            scrollable,
            user_scrolled_down,
            complete: GlobalFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
