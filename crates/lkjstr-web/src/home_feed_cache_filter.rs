use lkjstr_app::HomeFeedSourceState;
use lkjstr_protocol::normalize_relay_url;
use lkjstr_storage::StoredEventRecord;

#[derive(Clone)]
pub(crate) struct CacheCompleteFilter {
    since: u64,
    until: u64,
    relays: Vec<String>,
}

impl CacheCompleteFilter {
    pub(crate) fn accepts_event(&self, row: &StoredEventRecord) -> bool {
        row.event.created_at >= self.since && row.event.created_at < self.until
    }

    pub(crate) fn accepts_relays(&self, relays: &[String]) -> bool {
        relays.iter().any(|relay| {
            normalize_relay_url(relay)
                .as_ref()
                .is_some_and(|normalized| self.relays.contains(normalized))
        })
    }
}

pub(crate) fn cache_complete_filter(
    source_state: &HomeFeedSourceState,
    selected_relays: &[String],
    now_sec: u64,
) -> Option<CacheCompleteFilter> {
    if source_state != &HomeFeedSourceState::CacheComplete {
        return None;
    }
    Some(CacheCompleteFilter {
        since: now_sec.saturating_sub(30),
        until: now_sec,
        relays: selected_relays
            .iter()
            .filter_map(|relay| normalize_relay_url(relay))
            .collect(),
    })
}
