use std::collections::{BTreeMap, BTreeSet, VecDeque};

use lkjstr_protocol::{
    KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent, reply_parent,
};
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::sqlite_store::{SqliteStore, sqlite_event_get};

const MAX_PARENT_CHAIN_READS: usize = 24;

pub(crate) struct ThreadParentHydration {
    pub(crate) missing_count: usize,
}

pub(crate) async fn hydrate_parent_chain(
    store: &SqliteStore,
    rows: &mut BTreeMap<String, StoredEventRecord>,
    root_event_id: &str,
) -> StorageOutcome<ThreadParentHydration> {
    let mut queue = parent_queue(rows, root_event_id);
    let mut seen = rows.keys().cloned().collect::<BTreeSet<_>>();
    let mut missing_count = 0usize;
    let mut reads = 0usize;

    while let Some(parent_id) = queue.pop_front() {
        if parent_id == root_event_id || !seen.insert(parent_id.clone()) {
            continue;
        }
        reads += 1;
        if reads > MAX_PARENT_CHAIN_READS {
            break;
        }
        let parent = match sqlite_event_get(store, &parent_id).await {
            StorageOutcome::Ok(parent) => parent,
            outcome => return outcome.map(|_| ThreadParentHydration { missing_count }),
        };
        let Some(parent) = parent else {
            missing_count += 1;
            continue;
        };
        if is_thread_display_event(&parent.event) {
            if let Some(next_parent) = reply_parent(&parent.event) {
                queue.push_back(next_parent);
            }
            rows.insert(parent.event.id.clone(), parent);
        }
    }

    StorageOutcome::Ok(ThreadParentHydration { missing_count })
}

fn parent_queue(
    rows: &BTreeMap<String, StoredEventRecord>,
    root_event_id: &str,
) -> VecDeque<String> {
    rows.values()
        .filter_map(|row| reply_parent(&row.event))
        .filter(|id| id != root_event_id)
        .collect()
}

const fn is_thread_display_event(event: &NostrEvent) -> bool {
    matches!(event.kind, KIND_TEXT_NOTE | KIND_REPOST | KIND_GENERIC_REPOST)
}
