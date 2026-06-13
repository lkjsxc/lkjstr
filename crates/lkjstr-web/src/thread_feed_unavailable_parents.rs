use std::collections::BTreeSet;

use lkjstr_protocol::reply_parent;
use lkjstr_relays::ProgressiveReadSnapshot;

use crate::thread_feed_relay_input::{ThreadRelayReadInput, ThreadRelayReadPhase};

pub(crate) fn unavailable_parent_ids(
    input: &ThreadRelayReadInput,
    window: &lkjstr_app::FeedWindowState,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<String> {
    if !can_prove_parent_miss(input, snapshot) {
        return Vec::new();
    }
    let loaded = window
        .visible_events()
        .into_iter()
        .map(|item| item.event.id)
        .collect::<BTreeSet<_>>();
    input
        .cache_window
        .visible_events()
        .into_iter()
        .filter_map(|item| reply_parent(&item.event))
        .filter(|id| id != &input.root_event_id)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .filter(|id| !loaded.contains(id))
        .collect()
}

fn can_prove_parent_miss(
    input: &ThreadRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> bool {
    matches!(input.phase, ThreadRelayReadPhase::Initial)
        && snapshot.final_read
        && snapshot.status == lkjstr_relays::ProgressiveReadStatus::Complete
}
