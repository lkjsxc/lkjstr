use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_app::SearchFeedView;

use crate::workspace::search_provider::{SearchFeedLease, SearchFeedProvider};

#[derive(Clone, Default)]
pub(super) struct SearchRunController {
    lease: Arc<Mutex<Option<SearchFeedLease>>>,
}

impl SearchRunController {
    pub(super) fn new() -> Self {
        Self::default()
    }

    pub(super) fn run(
        &self,
        provider: Option<SearchFeedProvider>,
        owner: String,
        query: String,
        complete: Callback<SearchFeedView>,
    ) -> bool {
        release_query_lease(&self.lease);
        let Some(provider) = provider else {
            return false;
        };
        let lease = provider.read(owner, query, complete);
        remember_query_lease(&self.lease, lease);
        true
    }

    pub(super) fn release(&self) {
        release_query_lease(&self.lease);
    }
}

fn release_query_lease(slot: &Arc<Mutex<Option<SearchFeedLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_query_lease(slot: &Arc<Mutex<Option<SearchFeedLease>>>, lease: SearchFeedLease) {
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

    use crate::workspace::search_provider::SearchFeedRequest;

    use super::*;

    #[test]
    fn run_releases_previous_search_query_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let controller = SearchRunController::new();

        assert!(controller.run(
            Some(provider.clone()),
            "tab-a".to_owned(),
            "nostr".to_owned(),
            Callback::new(|_| {})
        ));
        assert!(controller.run(
            Some(provider),
            "tab-a".to_owned(),
            "wasm".to_owned(),
            Callback::new(|_| {})
        ));

        assert_eq!(requests.load(Ordering::SeqCst), 2);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
        controller.release();
        assert_eq!(releases.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn unavailable_provider_releases_active_search_query_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let controller = SearchRunController::new();

        assert!(controller.run(
            Some(provider(releases.clone(), requests.clone())),
            "tab-a".to_owned(),
            "nostr".to_owned(),
            Callback::new(|_| {})
        ));
        assert!(!controller.run(
            None,
            "tab-a".to_owned(),
            "nostr".to_owned(),
            Callback::new(|_| {})
        ));

        assert_eq!(requests.load(Ordering::SeqCst), 1);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
    }

    fn provider(releases: Arc<AtomicUsize>, requests: Arc<AtomicUsize>) -> SearchFeedProvider {
        SearchFeedProvider::new(move |request: SearchFeedRequest| {
            let releases = releases.clone();
            request.lease().on_release(move || {
                releases.fetch_add(1, Ordering::SeqCst);
            });
            requests.fetch_add(1, Ordering::SeqCst);
        })
    }
}
