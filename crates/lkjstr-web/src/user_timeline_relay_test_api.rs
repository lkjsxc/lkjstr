use lkjstr_app::{FeedViewRow, UserTimelineFeedStatus};
use lkjstr_domain::{
    RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent};
use lkjstr_storage::StorageOutcome;

use crate::{
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_set_put,
    user_timeline_host::UserTimelineHost,
    user_timeline_host_model::user_timeline_model,
    user_timeline_relay::store_user_timeline_relay_event,
    user_timeline_relay_input::{
        UserTimelineRelayInputSeed, UserTimelineRelayReadInput,
        user_timeline_event_matches_read, user_timeline_relay_filters,
        user_timeline_relay_input,
    },
};

pub struct UserTimelineRelayPlanProbe {
    pub relays: Vec<String>,
    pub selected_kinds: Vec<u64>,
    pub missing_relay_kinds: Vec<u64>,
}

pub struct UserTimelineRelayMatchProbe {
    pub follow_list: bool,
    pub note: bool,
    pub wrong_author: bool,
}

pub struct UserTimelineRelayStoreProbe {
    pub store_problem: Option<String>,
    pub status: UserTimelineFeedStatus,
    pub author_count: usize,
    pub event_count: usize,
}

pub fn user_timeline_relay_plan_probe() -> Option<UserTimelineRelayPlanProbe> {
    let input = input()?;
    Some(UserTimelineRelayPlanProbe {
        relays: input.relays.clone(),
        selected_kinds: filter_kinds(&input, "wss://selected.example"),
        missing_relay_kinds: filter_kinds(&input, "wss://missing.example"),
    })
}

pub fn user_timeline_relay_match_probe() -> Option<UserTimelineRelayMatchProbe> {
    let input = input()?;
    Some(UserTimelineRelayMatchProbe {
        follow_list: user_timeline_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("a"), "1", Vec::new(), ""),
        ),
        note: user_timeline_event_matches_read(
            &input,
            &event(KIND_TEXT_NOTE, &pubkey("a"), "2", Vec::new(), "note"),
        ),
        wrong_author: user_timeline_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("b"), "3", Vec::new(), ""),
        ),
    })
}

pub async fn user_timeline_relay_store_probe(
    db_name: &str,
    worker_url: &str,
) -> UserTimelineRelayStoreProbe {
    let host = UserTimelineHost {
        db_name: db_name.to_owned(),
        worker_url: worker_url.to_owned(),
    };
    if let Some(problem) = store_problem(store_relay_set(&host).await) {
        return failed(problem);
    }
    for event in [
        follow_event(&pubkey("a"), &pubkey("b")),
        event(KIND_TEXT_NOTE, &pubkey("b"), "2", Vec::new(), "relay cached note"),
    ] {
        if let Some(problem) =
            store_problem(store_user_timeline_relay_event(&host, relay(), event).await)
        {
            return failed(problem);
        }
    }
    let model = user_timeline_model(&host, "timeline-tab", Some(pubkey("a"))).await;
    UserTimelineRelayStoreProbe {
        store_problem: None,
        status: model.status,
        author_count: model.author_set.as_ref().map_or(0, |set| set.authors.len()),
        event_count: model
            .view_model
            .rows
            .iter()
            .filter(|row| matches!(row, FeedViewRow::Event(_)))
            .count(),
    }
}

fn input() -> Option<UserTimelineRelayReadInput> {
    user_timeline_relay_input(UserTimelineRelayInputSeed {
        owner: "timeline-tab",
        target_pubkey: &pubkey("a"),
        selected_relays: &["wss://selected.example".to_owned()],
        author_routes: &[],
    })
}

fn filter_kinds(input: &UserTimelineRelayReadInput, relay: &str) -> Vec<u64> {
    user_timeline_relay_filters(input, relay)
        .into_iter()
        .flat_map(|filter| filter.kinds.unwrap_or_default())
        .collect()
}

async fn store_relay_set(host: &UserTimelineHost) -> StorageOutcome<()> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_relay_set_put(&store, &relay_set()).await
    })
    .await
}

fn relay_set() -> RelaySet {
    RelaySet {
        id: "timeline-relay-test".to_owned(),
        name: "Timeline Relay Test".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![RelayRecord {
            url: relay().to_owned(),
            label: "Selected".to_owned(),
            enabled: true,
            read: true,
            write: false,
            state: RelayConnectionState::Idle,
            last_error: None,
            last_connected_at: None,
            updated_at: 9,
            health: RelayHealth::default(),
        }],
        updated_at: 9,
    }
}

fn follow_event(pubkey: &str, followed_pubkey: &str) -> NostrEvent {
    event(
        KIND_FOLLOW_LIST,
        pubkey,
        "1",
        vec![vec!["p".to_owned(), followed_pubkey.to_owned(), relay().to_owned()]],
        "",
    )
}

fn event(
    kind: u64,
    pubkey: &str,
    id_prefix: &str,
    tags: Vec<Vec<String>>,
    content: &str,
) -> NostrEvent {
    NostrEvent {
        id: id_prefix.repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: 1_999,
        kind,
        tags,
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn relay() -> &'static str {
    "wss://selected.example"
}

fn store_problem(outcome: StorageOutcome<()>) -> Option<String> {
    outcome.problem().map(|problem| problem.reason.to_owned())
}

fn failed(problem: String) -> UserTimelineRelayStoreProbe {
    UserTimelineRelayStoreProbe {
        store_problem: Some(problem),
        status: UserTimelineFeedStatus::Failed,
        author_count: 0,
        event_count: 0,
    }
}
