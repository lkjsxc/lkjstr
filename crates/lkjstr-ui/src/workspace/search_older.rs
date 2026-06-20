use std::sync::{Arc, Mutex};

use leptos::prelude::*;
use lkjstr_app::SearchFeedView;

use crate::workspace::search_provider::{SearchFeedLease, SearchFeedProvider};

#[derive(Clone)]
pub(super) struct SearchOlderLoader {
    owner: String,
    provider: SearchFeedProvider,
    complete: Callback<SearchFeedView>,
    lease: Arc<Mutex<Option<SearchFeedLease>>>,
}

impl SearchOlderLoader {
    pub(super) fn new(
        owner: String,
        provider: SearchFeedProvider,
        complete: Callback<SearchFeedView>,
    ) -> Self {
        Self {
            owner,
            provider,
            complete,
            lease: Arc::new(Mutex::new(None)),
        }
    }

    pub(super) fn command_callback(&self, model: RwSignal<SearchFeedView>) -> Callback<()> {
        let loader = self.clone();
        Callback::new(move |()| {
            let current = model.get_untracked();
            loader.request(&current);
        })
    }

    pub(super) fn request(&self, current: &SearchFeedView) {
        release_older_lease(&self.lease);
        if !current.window.has_older {
            return;
        }
        let Some(query) = current.submitted_query.clone() else {
            return;
        };
        let Some(lease) = self.provider.load_older(
            self.owner.clone(),
            query,
            current.window.clone(),
            self.complete,
        ) else {
            return;
        };
        remember_older_lease(&self.lease, lease);
    }

    pub(super) fn release(&self) {
        release_older_lease(&self.lease);
    }
}

fn release_older_lease(slot: &Arc<Mutex<Option<SearchFeedLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_older_lease(slot: &Arc<Mutex<Option<SearchFeedLease>>>, lease: SearchFeedLease) {
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

    use lkjstr_app::pending_search_feed_view;

    use super::*;

    #[test]
    fn request_releases_previous_search_older_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let loader = SearchOlderLoader::new("tab-a".to_owned(), provider, Callback::new(|_| {}));

        loader.request(&older_view("nostr"));
        loader.request(&older_view("wasm"));

        assert_eq!(requests.load(Ordering::SeqCst), 2);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
        loader.release();
        assert_eq!(releases.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn blocked_search_older_request_releases_active_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let loader = SearchOlderLoader::new("tab-a".to_owned(), provider, Callback::new(|_| {}));

        loader.request(&older_view("nostr"));
        loader.request(&pending_search_feed_view("tab-a", "nostr"));

        assert_eq!(requests.load(Ordering::SeqCst), 1);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn missing_query_search_older_request_releases_active_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let loader = SearchOlderLoader::new("tab-a".to_owned(), provider, Callback::new(|_| {}));

        loader.request(&older_view("nostr"));
        loader.request(&older_view_without_query());

        assert_eq!(requests.load(Ordering::SeqCst), 1);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
    }

    fn older_view(query: &str) -> SearchFeedView {
        let mut view = pending_search_feed_view("tab-a", query);
        view.window.has_older = true;
        view
    }

    fn older_view_without_query() -> SearchFeedView {
        let mut view = pending_search_feed_view("tab-a", "nostr");
        view.submitted_query = None;
        view.window.has_older = true;
        view
    }

    fn provider(releases: Arc<AtomicUsize>, requests: Arc<AtomicUsize>) -> SearchFeedProvider {
        SearchFeedProvider::with_older(
            |_| {},
            move |request| {
                let releases = releases.clone();
                request.lease().on_release(move || {
                    releases.fetch_add(1, Ordering::SeqCst);
                });
                requests.fetch_add(1, Ordering::SeqCst);
            },
        )
    }
}
