use std::time::Duration;

use leptos::prelude::*;
use lkjstr_storage::StorageStatsSnapshot;

use crate::workspace::stats_provider::StatsProvider;

const STATS_READ_TIMEOUT: Duration = Duration::from_secs(6);

#[derive(Clone, Copy)]
pub(crate) struct StatsRefreshState {
    request_id: RwSignal<u64>,
    timeout: RwSignal<Option<TimeoutHandle>>,
    interval: RwSignal<Option<IntervalHandle>>,
}

impl StatsRefreshState {
    pub(crate) fn new() -> Self {
        Self {
            request_id: RwSignal::new(0),
            timeout: RwSignal::new(None),
            interval: RwSignal::new(None),
        }
    }

    pub(crate) fn clear_all(&self) {
        self.clear_timeout();
        self.clear_interval();
    }

    pub(crate) fn clear_interval(&self) {
        if let Some(handle) = self.interval.get_untracked() {
            handle.clear();
            self.interval.set(None);
        }
    }

    pub(crate) fn set_interval(&self, handle: IntervalHandle) {
        self.interval.set(Some(handle));
    }

    fn next_request(&self) -> u64 {
        let request_id = self.request_id.get_untracked().saturating_add(1);
        self.request_id.set(request_id);
        request_id
    }

    fn is_current(&self, request_id: u64) -> bool {
        self.request_id.get_untracked() == request_id
    }

    fn expire(&self, request_id: u64) {
        if self.is_current(request_id) {
            self.request_id.set(request_id.saturating_add(1));
        }
        self.timeout.set(None);
    }

    fn clear_timeout(&self) {
        if let Some(handle) = self.timeout.get_untracked() {
            handle.clear();
            self.timeout.set(None);
        }
    }
}

pub(crate) fn refresh_stats(
    provider: StatsProvider,
    snapshot: RwSignal<Option<StorageStatsSnapshot>>,
    refreshing: RwSignal<bool>,
    state: StatsRefreshState,
) {
    let request_id = state.next_request();
    state.clear_timeout();
    refreshing.set(true);
    install_timeout(snapshot, refreshing, state, request_id);
    let complete_state = state;
    let complete = Callback::new(move |next| {
        if !complete_state.is_current(request_id) {
            return;
        }
        complete_state.clear_timeout();
        let _unused = snapshot.try_set(Some(next));
        let _unused = refreshing.try_set(false);
    });
    provider.read(complete);
}

fn install_timeout(
    snapshot: RwSignal<Option<StorageStatsSnapshot>>,
    refreshing: RwSignal<bool>,
    state: StatsRefreshState,
    request_id: u64,
) {
    let handle = set_timeout_with_handle(
        move || {
            if !state.is_current(request_id) {
                return;
            }
            let _unused = snapshot.try_set(Some(StorageStatsSnapshot::timeout()));
            let _unused = refreshing.try_set(false);
            state.expire(request_id);
        },
        STATS_READ_TIMEOUT,
    );
    if let Ok(handle) = handle {
        state.timeout.set(Some(handle));
    }
}
