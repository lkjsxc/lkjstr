use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::{FeedWindowState, SearchFeedView};

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct SearchFeedProvider {
    read: Arc<dyn Fn(SearchFeedRequest) + Send + Sync>,
    read_older: Arc<dyn Fn(SearchOlderRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct SearchFeedComplete {
    complete: Callback<SearchFeedView>,
}

#[derive(Clone)]
pub struct SearchFeedLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct SearchFeedRequest {
    pub owner: String,
    pub query: String,
    complete: SearchFeedComplete,
    lease: SearchFeedLease,
}

#[derive(Clone)]
pub struct SearchOlderRequest {
    pub owner: String,
    pub query: String,
    pub window: FeedWindowState,
    complete: SearchFeedComplete,
    lease: SearchFeedLease,
}

impl SearchFeedLease {
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

impl SearchFeedComplete {
    pub fn complete(&self, model: SearchFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl SearchFeedRequest {
    pub fn complete(&self, model: SearchFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> SearchFeedLease {
        self.lease.clone()
    }
}

impl SearchOlderRequest {
    pub fn complete(&self, model: SearchFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> SearchFeedLease {
        self.lease.clone()
    }
}

impl SearchFeedProvider {
    #[must_use]
    pub fn new(read: impl Fn(SearchFeedRequest) + Send + Sync + 'static) -> Self {
        Self {
            read: Arc::new(read),
            read_older: Arc::new(|_| {}),
        }
    }

    #[must_use]
    pub fn with_older(
        read: impl Fn(SearchFeedRequest) + Send + Sync + 'static,
        read_older: impl Fn(SearchOlderRequest) + Send + Sync + 'static,
    ) -> Self {
        Self {
            read: Arc::new(read),
            read_older: Arc::new(read_older),
        }
    }

    pub fn read(
        &self,
        owner: String,
        query: String,
        complete: Callback<SearchFeedView>,
    ) -> SearchFeedLease {
        let lease = SearchFeedLease::new();
        (self.read)(SearchFeedRequest {
            owner,
            query,
            complete: SearchFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }

    pub fn load_older(
        &self,
        owner: String,
        query: String,
        window: FeedWindowState,
        complete: Callback<SearchFeedView>,
    ) -> SearchFeedLease {
        let lease = SearchFeedLease::new();
        (self.read_older)(SearchOlderRequest {
            owner,
            query,
            window,
            complete: SearchFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
