use leptos::prelude::{Callable, Callback};
use lkjstr_storage::StorageStatsSnapshot;

use crate::workspace::stats_action_provider::StatsActions;

#[derive(Clone)]
pub struct StatsProvider {
    read: Callback<StatsComplete>,
    actions: StatsActions,
}

#[derive(Clone)]
pub struct StatsComplete {
    complete: Callback<StorageStatsSnapshot>,
}

impl StatsComplete {
    pub fn complete(&self, snapshot: StorageStatsSnapshot) {
        let _unused = self.complete.try_run(snapshot);
    }
}

impl StatsProvider {
    #[must_use]
    pub fn new(read: impl Fn(StatsComplete) + Send + Sync + 'static) -> Self {
        Self::with_actions(read, StatsActions::unavailable("host-missing"))
    }

    #[must_use]
    pub fn with_actions(
        read: impl Fn(StatsComplete) + Send + Sync + 'static,
        actions: StatsActions,
    ) -> Self {
        Self {
            read: Callback::new(read),
            actions,
        }
    }

    #[must_use]
    pub fn manifest_only() -> Self {
        Self::new(|complete| {
            complete.complete(StorageStatsSnapshot::manifest_unavailable("host-missing"));
        })
    }

    pub fn read(&self, complete: Callback<StorageStatsSnapshot>) {
        self.read.run(StatsComplete { complete });
    }

    #[must_use]
    pub fn actions(&self) -> StatsActions {
        self.actions.clone()
    }
}
