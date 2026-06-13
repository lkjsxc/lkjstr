use lkjstr_app::FolloweesStatus;
use lkjstr_domain::{
    RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent};
use lkjstr_storage::StorageOutcome;

use crate::{
    followees_host::{FolloweesHost, followees_model},
    followees_relay::store_followees_relay_event,
    followees_relay_input::{
        FolloweesRelayInputSeed, FolloweesRelayReadInput, followees_event_matches_read,
        followees_relay_filters, followees_relay_input,
    },
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_set_put,
};

pub struct FolloweesRelayPlanProbe {
    pub relays: Vec<String>,
    pub selected_kinds: Vec<u64>,
    pub missing_relay_kinds: Vec<u64>,
}

pub struct FolloweesRelayMatchProbe {
    pub follow_list: bool,
    pub note: bool,
    pub wrong_author: bool,
}

pub struct FolloweesRelayStoreProbe {
    pub store_problem: Option<String>,
    pub status: FolloweesStatus,
    pub following_count: usize,
    pub first_petname: Option<String>,
}

pub fn followees_relay_plan_probe() -> Option<FolloweesRelayPlanProbe> {
    let input = input()?;
    Some(FolloweesRelayPlanProbe {
        relays: input.relays.clone(),
        selected_kinds: filter_kinds(&input, "wss://selected.example"),
        missing_relay_kinds: filter_kinds(&input, "wss://missing.example"),
    })
}

pub fn followees_relay_match_probe() -> Option<FolloweesRelayMatchProbe> {
    let input = input()?;
    Some(FolloweesRelayMatchProbe {
        follow_list: followees_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("a"), "1", Vec::new(), ""),
        ),
        note: followees_event_matches_read(
            &input,
            &event(KIND_TEXT_NOTE, &pubkey("a"), "2", Vec::new(), "note"),
        ),
        wrong_author: followees_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("b"), "3", Vec::new(), ""),
        ),
    })
}

pub async fn followees_relay_store_probe(db_name: &str, worker_url: &str) -> FolloweesRelayStoreProbe {
    let host = FolloweesHost {
        db_name: db_name.to_owned(),
        worker_url: worker_url.to_owned(),
    };
    if let Some(problem) = store_problem(store_relay_set(&host).await) {
        return failed(problem);
    }
    if let Some(problem) = store_problem(
        store_followees_relay_event(&host, relay(), follow_event(&pubkey("a"), &pubkey("b"))).await,
    ) {
        return failed(problem);
    }
    let model = followees_model(&host, "followees-tab", Some(pubkey("a"))).await;
    FolloweesRelayStoreProbe {
        store_problem: None,
        status: model.status,
        following_count: model.following_count,
        first_petname: model.rows.first().and_then(|row| row.petname.clone()),
    }
}

fn input() -> Option<FolloweesRelayReadInput> {
    followees_relay_input(FolloweesRelayInputSeed {
        owner: "followees-tab",
        target_pubkey: &pubkey("a"),
        selected_relays: &["wss://selected.example".to_owned()],
    })
}

fn filter_kinds(input: &FolloweesRelayReadInput, relay: &str) -> Vec<u64> {
    followees_relay_filters(input, relay)
        .into_iter()
        .flat_map(|filter| filter.kinds.unwrap_or_default())
        .collect()
}

async fn store_relay_set(host: &FolloweesHost) -> StorageOutcome<()> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_relay_set_put(&store, &relay_set()).await
    })
    .await
}

fn relay_set() -> RelaySet {
    RelaySet {
        id: "followees-relay-test".to_owned(),
        name: "Followees Relay Test".to_owned(),
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
        vec![vec![
            "p".to_owned(),
            followed_pubkey.to_owned(),
            relay().to_owned(),
            "relay friend".to_owned(),
        ]],
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

fn failed(problem: String) -> FolloweesRelayStoreProbe {
    FolloweesRelayStoreProbe {
        store_problem: Some(problem),
        status: FolloweesStatus::Failed,
        following_count: 0,
        first_petname: None,
    }
}
