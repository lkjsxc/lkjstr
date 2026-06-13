use lkjstr_app::ProfileFeedSourceState;
use lkjstr_protocol::normalize_relay_url;
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::StoredEventRecord;

pub(crate) struct ProfileCacheFilter {
    relays: Vec<String>,
    range: Option<(u64, u64)>,
}

impl ProfileCacheFilter {
    pub(crate) fn new(
        source_state: &ProfileFeedSourceState,
        selected_relays: &[String],
        author_routes: &[AuthorRelayRoute],
        now_sec: u64,
    ) -> Self {
        let range = (source_state == &ProfileFeedSourceState::CacheComplete)
            .then_some((now_sec.saturating_sub(30), now_sec));
        Self::with_range(selected_relays, author_routes, range)
    }

    pub(crate) fn with_range(
        selected_relays: &[String],
        author_routes: &[AuthorRelayRoute],
        range: Option<(u64, u64)>,
    ) -> Self {
        let mut relays = selected_relays
            .iter()
            .chain(author_routes.iter().map(|route| &route.relay_url))
            .filter_map(|relay| normalize_relay_url(relay))
            .collect::<Vec<_>>();
        relays.sort();
        relays.dedup();
        Self { relays, range }
    }

    pub(crate) fn accepts_event(&self, row: &StoredEventRecord) -> bool {
        self.range.is_none_or(|(since, until)| {
            row.event.created_at >= since && row.event.created_at < until
        })
    }

    pub(crate) fn accepts_relays(&self, relays: &[String]) -> bool {
        relays.iter().any(|relay| {
            normalize_relay_url(relay)
                .as_ref()
                .is_some_and(|normalized| self.relays.contains(normalized))
        })
    }
}
