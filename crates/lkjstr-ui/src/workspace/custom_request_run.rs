use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::CustomRequestFeedView;

use crate::workspace::custom_request_provider::{CustomRequestLease, CustomRequestProvider};

#[derive(Clone, Default)]
pub(super) struct CustomRequestRunController {
    lease: Arc<Mutex<Option<CustomRequestLease>>>,
}

impl CustomRequestRunController {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn run(
        &self,
        provider: Option<CustomRequestProvider>,
        owner: String,
        raw_json: String,
        complete: Callback<CustomRequestFeedView>,
    ) -> bool {
        release_run_lease(&self.lease);
        let Some(provider) = provider else {
            return false;
        };
        let lease = provider.run(owner, raw_json, complete);
        remember_run_lease(&self.lease, lease);
        true
    }

    pub(super) fn release(&self) {
        release_run_lease(&self.lease);
    }
}

fn release_run_lease(slot: &Arc<Mutex<Option<CustomRequestLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_run_lease(slot: &Arc<Mutex<Option<CustomRequestLease>>>, lease: CustomRequestLease) {
    let previous = match slot.lock() {
        Ok(mut slot) => slot.replace(lease),
        Err(_) => {
            lease.release();
            return;
        }
    };
    if let Some(previous) = previous {
        previous.release();
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use crate::workspace::custom_request_provider::CustomRequestRunRequest;

    use super::*;

    #[test]
    fn run_releases_previous_custom_request_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let controller = CustomRequestRunController::new();

        assert!(controller.run(
            Some(provider.clone()),
            "tab-a".to_owned(),
            "{}".to_owned(),
            Callback::new(|_| {})
        ));
        assert!(controller.run(
            Some(provider),
            "tab-a".to_owned(),
            r#"{"kinds":[1]}"#.to_owned(),
            Callback::new(|_| {})
        ));

        assert_eq!(requests.load(Ordering::SeqCst), 2);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
        controller.release();
        assert_eq!(releases.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn unavailable_provider_releases_active_custom_request_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let controller = CustomRequestRunController::new();

        assert!(controller.run(
            Some(provider(releases.clone(), requests.clone())),
            "tab-a".to_owned(),
            "{}".to_owned(),
            Callback::new(|_| {})
        ));
        assert!(!controller.run(
            None,
            "tab-a".to_owned(),
            "{}".to_owned(),
            Callback::new(|_| {})
        ));

        assert_eq!(requests.load(Ordering::SeqCst), 1);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
    }

    fn provider(releases: Arc<AtomicUsize>, requests: Arc<AtomicUsize>) -> CustomRequestProvider {
        CustomRequestProvider::new(move |request: CustomRequestRunRequest| {
            let releases = releases.clone();
            request.lease().on_release(move || {
                releases.fetch_add(1, Ordering::SeqCst);
            });
            requests.fetch_add(1, Ordering::SeqCst);
        })
    }
}
