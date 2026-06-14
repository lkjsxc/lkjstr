use lkjstr_app::{ProfileFeedSourceState, empty_feed_window};
use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_METADATA, KIND_RELAY_LIST_METADATA, KIND_TEXT_NOTE, NostrEvent,
};
use lkjstr_relays::{AuthorRelayRoute, RouteEvidenceSource};
use lkjstr_storage::StorageOutcome;

use crate::{
    profile_feed_header::profile_header_state,
    profile_feed_header_relay::store_profile_header_event,
    profile_feed_header_relay_input::{
        ProfileHeaderRelayInputSeed, ProfileHeaderRelayReadInput,
        profile_header_event_matches_read, profile_header_relay_filters,
        profile_header_relay_input,
    },
    profile_feed_host::ProfileFeedHost,
};

pub struct ProfileHeaderRelayPlanProbe {
    pub relays: Vec<String>,
    pub author_kinds: Vec<u64>,
    pub selected_kinds: Vec<u64>,
    pub fallback_selected_kinds: Vec<u64>,
}

pub struct ProfileHeaderRelayMatchProbe {
    pub metadata: bool,
    pub follow_list: bool,
    pub relay_list_metadata: bool,
    pub note: bool,
    pub wrong_author: bool,
}

pub struct ProfileHeaderRelayStoreProbe {
    pub store_problem: Option<String>,
    pub display_name: Option<String>,
    pub following_label: Option<String>,
    pub following_known: bool,
}

pub fn header_relay_plan_probe() -> Option<ProfileHeaderRelayPlanProbe> {
    let routed = routed_input()?;
    let fallback = input(&[], &["wss://selected.example".to_owned()])?;
    Some(ProfileHeaderRelayPlanProbe {
        relays: routed.relays.clone(),
        author_kinds: filter_kinds(&routed, "wss://author.example"),
        selected_kinds: filter_kinds(&routed, "wss://selected.example"),
        fallback_selected_kinds: filter_kinds(&fallback, "wss://selected.example"),
    })
}

pub fn header_relay_match_probe() -> Option<ProfileHeaderRelayMatchProbe> {
    let input = routed_input()?;
    Some(ProfileHeaderRelayMatchProbe {
        metadata: profile_header_event_matches_read(&input, &event(KIND_METADATA, &pubkey(), "0")),
        follow_list: profile_header_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey(), "3"),
        ),
        relay_list_metadata: profile_header_event_matches_read(
            &input,
            &event(KIND_RELAY_LIST_METADATA, &pubkey(), "1"),
        ),
        note: profile_header_event_matches_read(&input, &event(KIND_TEXT_NOTE, &pubkey(), "2")),
        wrong_author: profile_header_event_matches_read(
            &input,
            &event(KIND_METADATA, &"b".repeat(64), "4"),
        ),
    })
}

pub async fn header_relay_store_probe(
    db_name: &str,
    worker_url: &str,
) -> ProfileHeaderRelayStoreProbe {
    let host = ProfileFeedHost {
        db_name: db_name.to_owned(),
        worker_url: worker_url.to_owned(),
    };
    for (relay, event) in [
        (
            "wss://author.example",
            event(KIND_METADATA, &pubkey(), "0")
                .with_content(r#"{"display_name":"Relay Rustacean"}"#),
        ),
        (
            "wss://selected.example",
            event(KIND_FOLLOW_LIST, &pubkey(), "3").with_tags(vec![
                vec!["p".to_owned(), "c".repeat(64)],
                vec!["p".to_owned(), "d".repeat(64)],
            ]),
        ),
    ] {
        if let Some(problem) = store_problem(store_profile_header_event(&host, relay, event).await)
        {
            return store_failed(problem);
        }
    }
    let mut diagnostics = Vec::new();
    let header = profile_header_state(&host, &pubkey(), &mut diagnostics).await;
    ProfileHeaderRelayStoreProbe {
        store_problem: None,
        display_name: header.as_ref().map(|item| item.display_name.clone()),
        following_label: header.as_ref().map(|item| item.following_label.clone()),
        following_known: header.is_some_and(|item| item.following_known),
    }
}

fn routed_input() -> Option<ProfileHeaderRelayReadInput> {
    input(
        &[AuthorRelayRoute {
            author: pubkey(),
            relay_url: "wss://author.example".to_owned(),
            source: RouteEvidenceSource::Nip65,
            score: 0,
        }],
        &["wss://selected.example".to_owned()],
    )
}

fn input(
    routes: &[AuthorRelayRoute],
    selected: &[String],
) -> Option<ProfileHeaderRelayReadInput> {
    profile_header_relay_input(ProfileHeaderRelayInputSeed {
        owner: "profile-tab",
        profile_pubkey: &Some(pubkey()),
        selected_relays: selected,
        view_selected_relays: selected,
        relay_sets_json: "[]",
        author_routes: routes,
        profile_header: &None,
        window: &empty_feed_window(1, 180),
        geometry_models: &[],
        source_state: &ProfileFeedSourceState::Pending,
        diagnostics: &[],
        now_sec: 2_000,
    })
}

fn filter_kinds(input: &ProfileHeaderRelayReadInput, relay: &str) -> Vec<u64> {
    profile_header_relay_filters(input, relay)
        .into_iter()
        .flat_map(|filter| filter.kinds.unwrap_or_default())
        .collect()
}

trait TestEvent {
    fn with_content(self, content: &str) -> Self;
    fn with_tags(self, tags: Vec<Vec<String>>) -> Self;
}

impl TestEvent for NostrEvent {
    fn with_content(mut self, content: &str) -> Self {
        self.content = content.to_owned();
        self
    }

    fn with_tags(mut self, tags: Vec<Vec<String>>) -> Self {
        self.tags = tags;
        self
    }
}

fn event(kind: u64, pubkey: &str, id_prefix: &str) -> NostrEvent {
    NostrEvent {
        id: id_prefix.repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: 1_999,
        kind,
        tags: Vec::new(),
        content: String::new(),
        sig: "f".repeat(128),
    }
}

fn pubkey() -> String {
    "a".repeat(64)
}

fn store_problem(outcome: StorageOutcome<()>) -> Option<String> {
    outcome.problem().map(|problem| problem.reason.to_owned())
}

fn store_failed(problem: String) -> ProfileHeaderRelayStoreProbe {
    ProfileHeaderRelayStoreProbe {
        store_problem: Some(problem),
        display_name: None,
        following_label: None,
        following_known: false,
    }
}
