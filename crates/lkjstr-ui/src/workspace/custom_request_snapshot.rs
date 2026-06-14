use leptos::prelude::{GetUntracked, Update};
use lkjstr_app::record_tab_snapshot;
use lkjstr_domain::{FeedTabSnapshot, TabSnapshotPayload};
use lkjstr_storage::{TabStateRecord, tab_state_id};

use crate::app::RuntimeSignal;
use crate::workspace::persistence::WorkspacePersistence;

const INPUT_KEY: &str = "customRequestInput";
const RAN_KEY: &str = "customRequestRan";

#[derive(Clone)]
pub(crate) struct CustomRequestSnapshotHandle {
    runtime: RuntimeSignal,
    pane_id: String,
    tab_id: String,
    persistence: Option<WorkspacePersistence>,
}

impl CustomRequestSnapshotHandle {
    #[must_use]
    pub(crate) fn new(
        runtime: RuntimeSignal,
        pane_id: String,
        tab_id: String,
        persistence: Option<WorkspacePersistence>,
    ) -> Self {
        Self {
            runtime,
            pane_id,
            tab_id,
            persistence,
        }
    }

    #[must_use]
    pub(crate) fn restored_input(&self, fallback: &str) -> String {
        snapshot_record(self.runtime, &self.tab_id)
            .and_then(|row| input_from_payload(&row.state))
            .unwrap_or_else(|| fallback.to_owned())
    }

    #[must_use]
    pub(crate) fn restored_ran(&self) -> bool {
        snapshot_record(self.runtime, &self.tab_id)
            .and_then(|row| ran_from_payload(&row.state))
            .unwrap_or(false)
    }

    pub(crate) fn save(&self, input: String, ran: bool) {
        let pane_id = self.pane_id.clone();
        let tab_id = self.tab_id.clone();
        self.runtime.update(|state| {
            let id = tab_state_id(&state.workspace.id, &tab_id);
            let current = state.tab_snapshots.get(&id).map(|row| row.state.clone());
            let payload = payload_with_state(current, input.clone(), ran);
            *state = record_tab_snapshot(state.clone(), Some(&pane_id), &tab_id, payload, 1);
        });
        if let (Some(persistence), Some(row)) = (
            self.persistence.clone(),
            snapshot_record(self.runtime, &self.tab_id),
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

fn input_from_payload(payload: &TabSnapshotPayload) -> Option<String> {
    let TabSnapshotPayload::Feed(feed) = payload else {
        return None;
    };
    feed.filter_state.get(INPUT_KEY).cloned()
}

fn ran_from_payload(payload: &TabSnapshotPayload) -> Option<bool> {
    let TabSnapshotPayload::Feed(feed) = payload else {
        return None;
    };
    Some(feed.filter_state.get(RAN_KEY)? == "true")
}

fn payload_with_state(
    current: Option<TabSnapshotPayload>,
    input: String,
    ran: bool,
) -> TabSnapshotPayload {
    let mut feed = match current {
        Some(TabSnapshotPayload::Feed(feed)) => feed,
        _ => FeedTabSnapshot::default(),
    };
    feed.filter_state.insert(INPUT_KEY.to_owned(), input);
    feed.filter_state
        .insert(RAN_KEY.to_owned(), ran.to_string());
    TabSnapshotPayload::Feed(feed)
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    #[test]
    fn custom_request_payload_preserves_feed_snapshot_fields() -> Result<(), &'static str> {
        let payload = payload_with_state(
            Some(TabSnapshotPayload::Feed(FeedTabSnapshot {
                scroll_top: Some(44),
                filter_state: BTreeMap::from([("other".to_owned(), "kept".to_owned())]),
                ..FeedTabSnapshot::default()
            })),
            r#"{"kinds":[1]}"#.to_owned(),
            true,
        );

        let TabSnapshotPayload::Feed(feed) = payload else {
            return Err("expected feed payload");
        };
        assert_eq!(feed.scroll_top, Some(44));
        assert_eq!(feed.filter_state.get("other"), Some(&"kept".to_owned()));
        assert_eq!(
            feed.filter_state.get(INPUT_KEY),
            Some(&r#"{"kinds":[1]}"#.to_owned())
        );
        assert_eq!(feed.filter_state.get(RAN_KEY), Some(&"true".to_owned()));
        Ok(())
    }

    #[test]
    fn custom_request_payload_ignores_tool_snapshots() {
        assert_eq!(
            input_from_payload(&TabSnapshotPayload::Tool(Default::default())),
            None
        );
        assert_eq!(
            ran_from_payload(&TabSnapshotPayload::Tool(Default::default())),
            None
        );
    }
}
