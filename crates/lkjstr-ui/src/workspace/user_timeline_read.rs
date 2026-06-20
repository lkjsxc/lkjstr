use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::UserTimelineFeedView;

use crate::workspace::user_timeline_provider::{UserTimelineLease, UserTimelineProvider};

#[derive(Clone, Default)]
pub(super) struct UserTimelineReadController {
    lease: Arc<Mutex<Option<UserTimelineLease>>>,
}

impl UserTimelineReadController {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn read(
        &self,
        provider: Option<UserTimelineProvider>,
        owner: String,
        target_pubkey: Option<String>,
        complete: Callback<UserTimelineFeedView>,
    ) -> bool {
        release_timeline_lease(&self.lease);
        let Some(provider) = provider else {
            return false;
        };
        let lease = provider.read(owner, target_pubkey, complete);
        remember_timeline_lease(&self.lease, lease);
        true
    }

    pub(super) fn release(&self) {
        release_timeline_lease(&self.lease);
    }
}

fn release_timeline_lease(slot: &Arc<Mutex<Option<UserTimelineLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_timeline_lease(slot: &Arc<Mutex<Option<UserTimelineLease>>>, lease: UserTimelineLease) {
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

    use crate::workspace::user_timeline_provider::UserTimelineRequest;

    use super::*;

    #[test]
    fn read_releases_previous_user_timeline_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let controller = UserTimelineReadController::new();

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
    fn unavailable_provider_releases_active_user_timeline_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let controller = UserTimelineReadController::new();

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

    fn provider(releases: Arc<AtomicUsize>, requests: Arc<AtomicUsize>) -> UserTimelineProvider {
        UserTimelineProvider::new(move |request: UserTimelineRequest| {
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
