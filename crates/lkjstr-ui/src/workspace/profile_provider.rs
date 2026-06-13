use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::ProfileFeedView;

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct ProfileFeedProvider {
    read: Arc<dyn Fn(ProfileFeedRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct ProfileFeedComplete {
    complete: Callback<ProfileFeedView>,
}

#[derive(Clone)]
pub struct ProfileFeedLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct ProfileFeedRequest {
    pub owner: String,
    pub profile_pubkey: Option<String>,
    complete: ProfileFeedComplete,
    lease: ProfileFeedLease,
}

impl ProfileFeedLease {
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

impl ProfileFeedComplete {
    pub fn complete(&self, model: ProfileFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl ProfileFeedRequest {
    pub fn complete(&self, model: ProfileFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> ProfileFeedLease {
        self.lease.clone()
    }
}

impl ProfileFeedProvider {
    #[must_use]
    pub fn new(read: impl Fn(ProfileFeedRequest) + Send + Sync + 'static) -> Self {
        Self {
            read: Arc::new(read),
        }
    }

    pub fn read(
        &self,
        owner: String,
        profile_pubkey: Option<String>,
        complete: Callback<ProfileFeedView>,
    ) -> ProfileFeedLease {
        let lease = ProfileFeedLease::new();
        (self.read)(ProfileFeedRequest {
            owner,
            profile_pubkey,
            complete: ProfileFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_app::default_profile_feed_view;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};

    #[test]
    fn profile_feed_lease_runs_release_cleanup_once() {
        let lease = ProfileFeedLease::new();
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
    fn released_profile_feed_request_suppresses_late_completion() {
        let request = Arc::new(Mutex::new(None::<ProfileFeedRequest>));
        let request_capture = request.clone();
        let provider = ProfileFeedProvider::new(move |next| match request_capture.lock() {
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
            Some("a".repeat(64)),
            Callback::new(move |_| completed_capture.store(true, Ordering::SeqCst)),
        );

        lease.release();
        let request = match request.lock() {
            Ok(request) => request,
            Err(poisoned) => poisoned.into_inner(),
        };
        let captured = request.as_ref().is_some();
        if let Some(request) = request.as_ref() {
            request.complete(default_profile_feed_view("tab-a", Some("a".repeat(64))));
        }

        assert!(captured, "request captured");
        assert!(!completed.load(Ordering::SeqCst));
    }
}
