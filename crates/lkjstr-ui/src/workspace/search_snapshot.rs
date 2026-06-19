use leptos::prelude::{Callable, Callback, GetUntracked, Update};
use lkjstr_app::record_tab_snapshot;
use lkjstr_domain::{FeedTabSnapshot, TabSnapshotPayload};
use lkjstr_storage::{TabStateRecord, tab_state_id};

use crate::app::RuntimeSignal;
use crate::workspace::persistence::WorkspacePersistence;

const SEARCH_QUERY_KEY: &str = "searchQuery";

#[derive(Clone)]
pub(crate) struct SearchSnapshotHandle {
    runtime: Option<RuntimeSignal>,
    pane_id: String,
    tab_id: String,
    persistence: Option<WorkspacePersistence>,
    restored_query: String,
    save_query: Option<Callback<String>>,
}

impl SearchSnapshotHandle {
    #[must_use]
    pub(crate) fn new(
        runtime: RuntimeSignal,
        pane_id: String,
        tab_id: String,
        persistence: Option<WorkspacePersistence>,
    ) -> Self {
        Self {
            runtime: Some(runtime),
            pane_id,
            tab_id,
            persistence,
            restored_query: String::new(),
            save_query: None,
        }
    }

    #[must_use]
    #[cfg(target_arch = "wasm32")]
    pub(crate) fn callback(restored_query: String, save_query: Callback<String>) -> Self {
        Self {
            runtime: None,
            pane_id: String::new(),
            tab_id: String::new(),
            persistence: None,
            restored_query,
            save_query: Some(save_query),
        }
    }

    #[must_use]
    pub(crate) fn restored_query(&self) -> String {
        self.runtime
            .and_then(|runtime| snapshot_record(runtime, &self.tab_id))
            .and_then(|row| search_query_from_payload(&row.state))
            .unwrap_or_else(|| self.restored_query.clone())
    }

    pub(crate) fn save_query(&self, query: String) {
        if let Some(save_query) = &self.save_query {
            save_query.run(query.clone());
        }
        let Some(runtime) = self.runtime else {
            return;
        };
        let pane_id = self.pane_id.clone();
        let tab_id = self.tab_id.clone();
        runtime.update(|state| {
            let id = tab_state_id(&state.workspace.id, &tab_id);
            let current = state.tab_snapshots.get(&id).map(|row| row.state.clone());
            let payload = search_query_payload(current, query.clone());
            *state = record_tab_snapshot(state.clone(), Some(&pane_id), &tab_id, payload, 1);
        });
        if let (Some(persistence), Some(row)) = (
            self.persistence.clone(),
            snapshot_record(runtime, &self.tab_id),
        ) {
            persistence.save_tab_snapshot(row);
        }
    }
}

fn snapshot_record(runtime: RuntimeSignal, tab_id: &str) -> Option<TabStateRecord> {
    let state = runtime.get_untracked();
    let id = tab_state_id(&state.workspace.id, tab_id);
    state.tab_snapshots.get(&id).cloned()
}

fn search_query_from_payload(payload: &TabSnapshotPayload) -> Option<String> {
    let TabSnapshotPayload::Feed(feed) = payload else {
        return None;
    };
    feed.filter_state.get(SEARCH_QUERY_KEY).cloned()
}

fn search_query_payload(current: Option<TabSnapshotPayload>, query: String) -> TabSnapshotPayload {
    let mut feed = match current {
        Some(TabSnapshotPayload::Feed(feed)) => feed,
        _ => FeedTabSnapshot::default(),
    };
    feed.filter_state.insert(SEARCH_QUERY_KEY.to_owned(), query);
    TabSnapshotPayload::Feed(feed)
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    #[test]
    fn search_query_payload_preserves_feed_snapshot_fields() -> Result<(), &'static str> {
        let payload = search_query_payload(
            Some(TabSnapshotPayload::Feed(FeedTabSnapshot {
                scroll_top: Some(44),
                filter_state: BTreeMap::from([("other".to_owned(), "kept".to_owned())]),
                ..FeedTabSnapshot::default()
            })),
            "nostr wasm".to_owned(),
        );

        let TabSnapshotPayload::Feed(feed) = payload else {
            return Err("expected feed payload");
        };
        assert_eq!(feed.scroll_top, Some(44));
        assert_eq!(feed.filter_state.get("other"), Some(&"kept".to_owned()));
        assert_eq!(
            feed.filter_state.get(SEARCH_QUERY_KEY),
            Some(&"nostr wasm".to_owned())
        );
        Ok(())
    }

    #[test]
    fn search_query_from_payload_ignores_tool_snapshots() {
        assert_eq!(
            search_query_from_payload(&TabSnapshotPayload::Tool(Default::default())),
            None
        );
    }
}
