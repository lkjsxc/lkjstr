use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::AuthorContextFeedView;

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct AuthorContextFeedProvider {
    read: Arc<dyn Fn(AuthorContextFeedRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct AuthorContextFeedComplete {
    complete: Callback<AuthorContextFeedView>,
}

#[derive(Clone)]
pub struct AuthorContextFeedLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct AuthorContextFeedRequest {
    pub owner: String,
    pub event_id: Option<String>,
    pub author_pubkey: Option<String>,
    complete: AuthorContextFeedComplete,
    lease: AuthorContextFeedLease,
}

impl AuthorContextFeedLease {
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
}

impl AuthorContextFeedComplete {
    pub fn complete(&self, model: AuthorContextFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl AuthorContextFeedRequest {
    pub fn complete(&self, model: AuthorContextFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }
}

impl AuthorContextFeedProvider {
    #[must_use]
    pub fn new(read: impl Fn(AuthorContextFeedRequest) + Send + Sync + 'static) -> Self {
        Self {
            read: Arc::new(read),
        }
    }

    pub fn read(
        &self,
        owner: String,
        event_id: Option<String>,
        author_pubkey: Option<String>,
        complete: Callback<AuthorContextFeedView>,
    ) -> AuthorContextFeedLease {
        let lease = AuthorContextFeedLease::new();
        (self.read)(AuthorContextFeedRequest {
            owner,
            event_id,
            author_pubkey,
            complete: AuthorContextFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
