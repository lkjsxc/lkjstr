use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::{ThreadFeedView, ThreadOlderLoadTrigger};

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct ThreadFeedProvider {
    read: Arc<dyn Fn(ThreadFeedRequest) + Send + Sync>,
    load_older: Arc<dyn Fn(ThreadOlderRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct ThreadFeedComplete {
    complete: Callback<ThreadFeedView>,
}

#[derive(Clone)]
pub struct ThreadFeedLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct ThreadFeedRequest {
    pub owner: String,
    pub event_id: Option<String>,
    complete: ThreadFeedComplete,
    lease: ThreadFeedLease,
}

#[derive(Clone)]
pub struct ThreadOlderRequest {
    pub owner: String,
    pub event_id: Option<String>,
    pub trigger: ThreadOlderLoadTrigger,
    pub scrollable: bool,
    pub user_scrolled_down: bool,
    complete: ThreadFeedComplete,
    lease: ThreadFeedLease,
}

impl ThreadFeedLease {
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

impl ThreadFeedComplete {
    pub fn complete(&self, model: ThreadFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl ThreadFeedRequest {
    pub fn complete(&self, model: ThreadFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> ThreadFeedLease {
        self.lease.clone()
    }
}

impl ThreadOlderRequest {
    pub fn complete(&self, model: ThreadFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> ThreadFeedLease {
        self.lease.clone()
    }
}

impl ThreadFeedProvider {
    #[must_use]
    pub fn new(read: impl Fn(ThreadFeedRequest) + Send + Sync + 'static) -> Self {
        Self::with_older(read, |_| {})
    }

    #[must_use]
    pub fn with_older(
        read: impl Fn(ThreadFeedRequest) + Send + Sync + 'static,
        load_older: impl Fn(ThreadOlderRequest) + Send + Sync + 'static,
    ) -> Self {
        Self {
            read: Arc::new(read),
            load_older: Arc::new(load_older),
        }
    }

    pub fn read(
        &self,
        owner: String,
        event_id: Option<String>,
        complete: Callback<ThreadFeedView>,
    ) -> ThreadFeedLease {
        let lease = ThreadFeedLease::new();
        (self.read)(ThreadFeedRequest {
            owner,
            event_id,
            complete: ThreadFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }

    pub fn load_older(
        &self,
        owner: String,
        event_id: Option<String>,
        trigger: ThreadOlderLoadTrigger,
        scrollable: bool,
        user_scrolled_down: bool,
        complete: Callback<ThreadFeedView>,
    ) -> ThreadFeedLease {
        let lease = ThreadFeedLease::new();
        (self.load_older)(ThreadOlderRequest {
            owner,
            event_id,
            trigger,
            scrollable,
            user_scrolled_down,
            complete: ThreadFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
