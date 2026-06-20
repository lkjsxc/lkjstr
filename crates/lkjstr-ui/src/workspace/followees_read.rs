use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::FolloweesView;

use crate::workspace::followees_provider::{FolloweesLease, FolloweesProvider};

#[derive(Clone, Default)]
pub(super) struct FolloweesReadController {
    lease: Arc<Mutex<Option<FolloweesLease>>>,
}

impl FolloweesReadController {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn read(
        &self,
        provider: Option<FolloweesProvider>,
        owner: String,
        target_pubkey: Option<String>,
        complete: Callback<FolloweesView>,
    ) -> bool {
        release_followees_lease(&self.lease);
        let Some(provider) = provider else {
            return false;
        };
        let lease = provider.read(owner, target_pubkey, complete);
        remember_followees_lease(&self.lease, lease);
        true
    }

    pub(super) fn release(&self) {
        release_followees_lease(&self.lease);
    }
}

fn release_followees_lease(slot: &Arc<Mutex<Option<FolloweesLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_followees_lease(slot: &Arc<Mutex<Option<FolloweesLease>>>, lease: FolloweesLease) {
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

    use crate::workspace::followees_provider::FolloweesRequest;

    use super::*;

    #[test]
    fn read_releases_previous_followees_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let controller = FolloweesReadController::new();

        assert!(controller.read(
            Some(provider.clone()),
            "tab-a".to_owned(),
            Some(pubkey("a")),
            Callback::new(|_| {})
        ));
        assert!(controller.read(
            Some(provider),
            "tab-a".to_owned(),
            Some(pubkey("b")),
            Callback::new(|_| {})
        ));

        assert_eq!(requests.load(Ordering::SeqCst), 2);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
        controller.release();
        assert_eq!(releases.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn unavailable_provider_releases_active_followees_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let controller = FolloweesReadController::new();

        assert!(controller.read(
            Some(provider(releases.clone(), requests.clone())),
            "tab-a".to_owned(),
            Some(pubkey("a")),
            Callback::new(|_| {})
        ));
        assert!(!controller.read(
            None,
            "tab-a".to_owned(),
            Some(pubkey("a")),
            Callback::new(|_| {})
        ));

        assert_eq!(requests.load(Ordering::SeqCst), 1);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
    }

    fn provider(releases: Arc<AtomicUsize>, requests: Arc<AtomicUsize>) -> FolloweesProvider {
        FolloweesProvider::new(move |request: FolloweesRequest| {
            let releases = releases.clone();
            request.lease().on_release(move || {
                releases.fetch_add(1, Ordering::SeqCst);
            });
            requests.fetch_add(1, Ordering::SeqCst);
        })
    }

    fn pubkey(prefix: &str) -> String {
        format!("{prefix}{}", "0".repeat(63))
    }
}
