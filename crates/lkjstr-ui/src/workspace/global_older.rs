use std::sync::{Arc, Mutex};

use leptos::prelude::*;
use lkjstr_app::{GlobalFeedView, GlobalOlderLoadTrigger};

use crate::workspace::global_provider::{GlobalFeedLease, GlobalFeedProvider};

#[derive(Clone)]
pub(super) struct GlobalOlderLoader {
    owner: String,
    provider: GlobalFeedProvider,
    complete: Callback<GlobalFeedView>,
    lease: Arc<Mutex<Option<GlobalFeedLease>>>,
}

impl GlobalOlderLoader {
    pub(super) fn new(
        owner: String,
        provider: GlobalFeedProvider,
        complete: Callback<GlobalFeedView>,
    ) -> Self {
        Self {
            owner,
            provider,
            complete,
            lease: Arc::new(Mutex::new(None)),
        }
    }

    pub(super) fn command_callback(&self) -> Callback<GlobalOlderLoadTrigger> {
        let loader = self.clone();
        Callback::new(move |trigger| loader.request(trigger, false, true))
    }

    pub(super) fn request(
        &self,
        trigger: GlobalOlderLoadTrigger,
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

fn release_older_lease(slot: &Arc<Mutex<Option<GlobalFeedLease>>>) {
    let lease = match slot.lock() {
        Ok(mut slot) => slot.take(),
        Err(_) => None,
    };
    if let Some(lease) = lease {
        lease.release();
    }
}

fn remember_older_lease(slot: &Arc<Mutex<Option<GlobalFeedLease>>>, lease: GlobalFeedLease) {
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
