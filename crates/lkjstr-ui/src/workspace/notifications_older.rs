use std::sync::{Arc, Mutex};

use leptos::prelude::*;
use lkjstr_app::{NotificationsFeedView, NotificationsOlderLoadTrigger};

use crate::workspace::notifications_provider::{NotificationsFeedLease, NotificationsFeedProvider};

#[derive(Clone)]
pub(super) struct NotificationsOlderLoader {
    owner: String,
    provider: NotificationsFeedProvider,
    complete: Callback<NotificationsFeedView>,
    lease: Arc<Mutex<Option<NotificationsFeedLease>>>,
}

impl NotificationsOlderLoader {
    pub(super) fn new(
        owner: String,
        provider: NotificationsFeedProvider,
        complete: Callback<NotificationsFeedView>,
    ) -> Self {
        Self {
            owner,
            provider,
            complete,
            lease: Arc::new(Mutex::new(None)),
        }
    }

    pub(super) fn command_callback(&self) -> Callback<NotificationsOlderLoadTrigger> {
        let loader = self.clone();
        Callback::new(move |trigger| loader.request(trigger, false, true))
    }

    pub(super) fn request(
        &self,
        trigger: NotificationsOlderLoadTrigger,
        scrollable: bool,
        user_scrolled_down: bool,
    ) {
        release_older_lease(&self.lease);
        let Some(lease) = self.provider.load_older(
            self.owner.clone(),
            trigger,
            scrollable,
            user_scrolled_down,
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

fn release_older_lease(slot: &Arc<Mutex<Option<NotificationsFeedLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_older_lease(
    slot: &Arc<Mutex<Option<NotificationsFeedLease>>>,
    lease: NotificationsFeedLease,
) {
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

    use super::*;

    #[test]
    fn request_releases_previous_notifications_older_lease() {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let provider = provider(releases.clone(), requests.clone());
        let loader =
            NotificationsOlderLoader::new("tab-a".to_owned(), provider, Callback::new(|_| {}));

        loader.request(NotificationsOlderLoadTrigger::Explicit, false, true);
        loader.request(NotificationsOlderLoadTrigger::Scroll, true, true);

        assert_eq!(requests.load(Ordering::SeqCst), 2);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
        loader.release();
        assert_eq!(releases.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn unsupported_notifications_older_request_releases_active_lease() -> Result<(), String> {
        let releases = Arc::new(AtomicUsize::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let Some(active) = provider(releases.clone(), requests.clone()).load_older(
            "tab-a".to_owned(),
            NotificationsOlderLoadTrigger::Explicit,
            false,
            true,
            Callback::new(|_| {}),
        ) else {
            return Err("supported older provider returns a lease".to_owned());
        };
        let loader = NotificationsOlderLoader::new(
            "tab-a".to_owned(),
            NotificationsFeedProvider::new(|_| {}),
            Callback::new(|_| {}),
        );
        remember_older_lease(&loader.lease, active);

        loader.request(NotificationsOlderLoadTrigger::Scroll, true, true);

        assert_eq!(requests.load(Ordering::SeqCst), 1);
        assert_eq!(releases.load(Ordering::SeqCst), 1);
        Ok(())
    }

    fn provider(
        releases: Arc<AtomicUsize>,
        requests: Arc<AtomicUsize>,
    ) -> NotificationsFeedProvider {
        NotificationsFeedProvider::with_older(
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
