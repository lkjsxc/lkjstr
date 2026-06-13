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
        let lease = self.provider.load_older(
            self.owner.clone(),
            trigger,
            scrollable,
            user_scrolled_down,
            self.complete,
        );
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
