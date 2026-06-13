use std::sync::Arc;

use leptos::prelude::{Callable, Callback};
use lkjstr_app::{NotificationsFeedView, NotificationsOlderLoadTrigger};

use crate::workspace::local_lease::LocalLease;

#[derive(Clone)]
pub struct NotificationsFeedProvider {
    read: Arc<dyn Fn(NotificationsFeedRequest) + Send + Sync>,
    load_older: Arc<dyn Fn(NotificationsOlderRequest) + Send + Sync>,
}

#[derive(Clone)]
pub struct NotificationsFeedComplete {
    complete: Callback<NotificationsFeedView>,
}

#[derive(Clone)]
pub struct NotificationsFeedLease {
    state: LocalLease,
}

#[derive(Clone)]
pub struct NotificationsFeedRequest {
    pub owner: String,
    complete: NotificationsFeedComplete,
    lease: NotificationsFeedLease,
}

#[derive(Clone)]
pub struct NotificationsOlderRequest {
    pub owner: String,
    pub trigger: NotificationsOlderLoadTrigger,
    pub scrollable: bool,
    pub user_scrolled_down: bool,
    complete: NotificationsFeedComplete,
    lease: NotificationsFeedLease,
}

impl NotificationsFeedLease {
    #[must_use]
    fn new() -> Self {
        Self {
            state: LocalLease::new(),
        }
    }

    pub fn release(&self) {
        self.state.release();
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.state.is_released()
    }

    pub fn on_release(&self, cleanup: impl FnOnce() + Send + Sync + 'static) {
        self.state.on_release(cleanup);
    }
}

impl NotificationsFeedComplete {
    pub fn complete(&self, model: NotificationsFeedView) {
        let _unused = self.complete.try_run(model);
    }
}

impl NotificationsFeedRequest {
    pub fn complete(&self, model: NotificationsFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> NotificationsFeedLease {
        self.lease.clone()
    }
}

impl NotificationsOlderRequest {
    pub fn complete(&self, model: NotificationsFeedView) {
        if !self.lease.is_released() {
            self.complete.complete(model);
        }
    }

    #[must_use]
    pub fn is_released(&self) -> bool {
        self.lease.is_released()
    }

    #[must_use]
    pub fn lease(&self) -> NotificationsFeedLease {
        self.lease.clone()
    }
}

impl NotificationsFeedProvider {
    #[must_use]
    pub fn new(read: impl Fn(NotificationsFeedRequest) + Send + Sync + 'static) -> Self {
        Self::with_older(read, |_| {})
    }

    #[must_use]
    pub fn with_older(
        read: impl Fn(NotificationsFeedRequest) + Send + Sync + 'static,
        load_older: impl Fn(NotificationsOlderRequest) + Send + Sync + 'static,
    ) -> Self {
        Self {
            read: Arc::new(read),
            load_older: Arc::new(load_older),
        }
    }

    pub fn read(
        &self,
        owner: String,
        complete: Callback<NotificationsFeedView>,
    ) -> NotificationsFeedLease {
        let lease = NotificationsFeedLease::new();
        (self.read)(NotificationsFeedRequest {
            owner,
            complete: NotificationsFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }

    pub fn load_older(
        &self,
        owner: String,
        trigger: NotificationsOlderLoadTrigger,
        scrollable: bool,
        user_scrolled_down: bool,
        complete: Callback<NotificationsFeedView>,
    ) -> NotificationsFeedLease {
        let lease = NotificationsFeedLease::new();
        (self.load_older)(NotificationsOlderRequest {
            owner,
            trigger,
            scrollable,
            user_scrolled_down,
            complete: NotificationsFeedComplete { complete },
            lease: lease.clone(),
        });
        lease
    }
}
