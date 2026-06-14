use std::sync::{Arc, Mutex};

use leptos::prelude::*;
use lkjstr_app::{ThreadFeedView, ThreadOlderLoadTrigger};

use crate::workspace::thread_provider::{ThreadFeedLease, ThreadFeedProvider};

#[derive(Clone)]
pub(super) struct ThreadOlderLoader {
    owner: String,
    event_id: Option<String>,
    provider: ThreadFeedProvider,
    complete: Callback<ThreadFeedView>,
    lease: Arc<Mutex<Option<ThreadFeedLease>>>,
}

impl ThreadOlderLoader {
    pub(super) fn new(
        owner: String,
        event_id: Option<String>,
        provider: ThreadFeedProvider,
        complete: Callback<ThreadFeedView>,
    ) -> Self {
        Self {
            owner,
            event_id,
            provider,
            complete,
            lease: Arc::new(Mutex::new(None)),
        }
    }

    pub(super) fn command_callback(&self) -> Callback<ThreadOlderLoadTrigger> {
        let loader = self.clone();
        Callback::new(move |trigger| loader.request(trigger, false, true))
    }

    pub(super) fn request(
        &self,
        trigger: ThreadOlderLoadTrigger,
        scrollable: bool,
        user_scrolled_down: bool,
    ) {
        release_older_lease(&self.lease);
        let Some(lease) = self.provider.load_older(
            self.owner.clone(),
            self.event_id.clone(),
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

fn release_older_lease(slot: &Arc<Mutex<Option<ThreadFeedLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_older_lease(slot: &Arc<Mutex<Option<ThreadFeedLease>>>, lease: ThreadFeedLease) {
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
