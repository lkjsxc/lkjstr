use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::HomeFeedView;

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct HomeFeedProvider {
    read: Arc<dyn Fn(HomeFeedRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct HomeFeedComplete {
    complete: Callback<HomeFeedView>,
}

#[derive(Clone)]
pub struct HomeFeedLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct HomeFeedRequest {
    pub owner: String,
    complete: HomeFeedComplete,
    lease: HomeFeedLease,
}

impl HomeFeedLease {
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

impl HomeFeedComplete {
    pub fn complete(&self, model: HomeFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl HomeFeedRequest {
    pub fn complete(&self, model: HomeFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> HomeFeedLease {
        self.lease.clone()
    }
}

impl HomeFeedProvider {
    #[must_use]
    pub fn new(read: impl Fn(HomeFeedRequest) + Send + Sync + 'static) -> Self {
        Self {
            read: Arc::new(read),
        }
    }

    pub fn read(&self, owner: String, complete: Callback<HomeFeedView>) -> HomeFeedLease {
        let lease = HomeFeedLease::new();
        (self.read)(HomeFeedRequest {
            owner,
            complete: HomeFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_app::default_home_feed_view;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};

    #[test]
    fn home_feed_lease_runs_release_cleanup_once() {
        let lease = HomeFeedLease::new();
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_capture = calls.clone();
        lease.on_release(move || {
            calls_capture.fetch_add(1, Ordering::SeqCst);
        });

        lease.release();
        lease.release();

        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn released_home_feed_request_suppresses_late_completion() {
        let request = Arc::new(Mutex::new(None::<HomeFeedRequest>));
        let request_capture = request.clone();
        let provider = HomeFeedProvider::new(move |next| match request_capture.lock() {
            Ok(mut request) => {
                request.replace(next);
            }
            Err(poisoned) => {
                poisoned.into_inner().replace(next);
            }
        });
        let completed = Arc::new(AtomicBool::new(false));
        let completed_capture = completed.clone();
        let lease = provider.read(
            "tab-a".to_owned(),
            Callback::new(move |_| completed_capture.store(true, Ordering::SeqCst)),
        );

        lease.release();
        let request = match request.lock() {
            Ok(request) => request,
            Err(poisoned) => poisoned.into_inner(),
        };
        let captured = request.as_ref().is_some();
        if let Some(request) = request.as_ref() {
            request.complete(default_home_feed_view("tab-a", None));
        }

        assert!(captured, "request captured");
        assert!(!completed.load(Ordering::SeqCst));
    }
}
