use super::*;
use crate::workspace::home_provider::HomeFeedRequest;
use lkjstr_app::default_home_feed_view;
use std::sync::atomic::{AtomicUsize, Ordering};

#[test]
fn duplicate_clicks_are_blocked_until_release_and_late_results_are_ignored() -> Result<(), String> {
    let owner = Owner::new();
    owner.with(|| {
        let requests = Arc::new(Mutex::new(Vec::<HomeFeedRequest>::new()));
        let capture = requests.clone();
        let complete_count = Arc::new(AtomicUsize::new(0));
        let count = complete_count.clone();
        let provider = HomeFeedProvider::with_older(
            |_| {},
            move |request| {
                if let Ok(mut requests) = capture.lock() {
                    requests.push(request);
                }
            },
        );
        let loader = HomeOlderLoader::new(
            "tab".to_owned(),
            provider,
            Callback::new(move |_| {
                count.fetch_add(1, Ordering::SeqCst);
            }),
        );
        loader.request();
        loader.request();
        assert!(loader.loading.get_untracked());
        let first = requests
            .lock()
            .map_err(|_| "request lock")?
            .first()
            .cloned()
            .ok_or("first request")?;
        assert_eq!(requests.lock().map_err(|_| "request lock")?.len(), 1);
        first.complete(default_home_feed_view("tab", None));
        first.lease().release();
        assert!(!loader.loading.get_untracked());
        loader.request();
        assert_eq!(requests.lock().map_err(|_| "request lock")?.len(), 2);
        first.complete(default_home_feed_view("tab", None));
        assert_eq!(complete_count.load(Ordering::SeqCst), 1);
        let second = requests
            .lock()
            .map_err(|_| "request lock")?
            .get(1)
            .cloned()
            .ok_or("second request")?;
        loader.release();
        assert!(second.is_released());
        second.complete(default_home_feed_view("tab", None));
        loader.request();
        assert_eq!(requests.lock().map_err(|_| "request lock")?.len(), 2);
        assert_eq!(complete_count.load(Ordering::SeqCst), 1);
        Ok(())
    })
}

#[test]
fn synchronous_rejection_does_not_leave_loading_or_retain_a_lease() {
    let owner = Owner::new();
    owner.with(|| {
        let provider = HomeFeedProvider::with_older(|_| {}, |request| request.lease().release());
        let loader = HomeOlderLoader::new("tab".to_owned(), provider, Callback::new(|_| {}));
        loader.request();
        assert!(!loader.loading.get_untracked());
        assert!(
            loader
                .state
                .lock()
                .is_ok_and(|state| !state.busy && state.lease.is_none())
        );
        loader.request();
        assert!(!loader.loading.get_untracked());
        loader.release();
    });
}

#[test]
fn unsupported_provider_has_no_older_handler_or_pending_loader() {
    let owner = Owner::new();
    owner.with(|| {
        let provider = HomeFeedProvider::new(|_| {});
        assert!(!provider.supports_older());
        assert!(
            provider
                .load_older("tab".to_owned(), Callback::new(|_| {}))
                .is_none()
        );
        let loader = HomeOlderLoader::new("tab".to_owned(), provider, Callback::new(|_| {}));
        loader.request();
        assert!(!loader.loading.get_untracked());
        loader.release();
    });
}
