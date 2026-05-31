use leptos::prelude::{Callable, Callback};
use lkjstr_storage::StorageStatsSnapshot;

#[derive(Clone)]
pub struct StatsProvider {
    read: Callback<StatsComplete>,
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
        Self {
            read: Callback::new(read),
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
}
