use lkjstr_app::{FeedWindowEvidence, FeedWindowFlags, empty_feed_window, reduce_feed_window};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent, NostrFilter};
use lkjstr_relays::ProgressiveEvent;

use crate::{
    author_context_relay::author_context_relay_plan,
    author_context_relay_input::{AuthorContextRelayReadInput, author_context_event_matches_read},
};

pub struct AuthorContextRelayFilterProbe {
    pub ids: Option<Vec<String>>,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub limit: Option<u64>,
    pub authors: Option<Vec<String>>,
    pub kinds: Option<Vec<u64>>,
}

pub struct AuthorContextRelayPlanProbe {
    pub sub_id: String,
    pub relays: Vec<String>,
    pub filters: Vec<AuthorContextRelayFilterProbe>,
}

pub struct AuthorContextRelayMatchProbe {
    pub older_same_author: bool,
    pub newer_same_author: bool,
    pub exact_anchor: bool,
    pub nearby_before_anchor: bool,
    pub wrong_author: bool,
    pub unsupported_kind: bool,
    pub outside_window: bool,
}

pub fn author_context_relay_plan_probe() -> Option<AuthorContextRelayPlanProbe> {
    let plan = author_context_relay_plan(&input(Some(1_700_000_010)))?;
    Some(plan_probe(plan))
}

pub fn author_context_anchor_plan_probe() -> Option<AuthorContextRelayPlanProbe> {
    let plan = author_context_relay_plan(&input(None))?;
    Some(plan_probe(plan))
}

fn plan_probe(
    plan: crate::author_context_relay::AuthorContextRelayPlan,
) -> AuthorContextRelayPlanProbe {
    AuthorContextRelayPlanProbe {
        sub_id: plan.sub_id,
        relays: plan.relays,
        filters: plan.filters.iter().map(filter_probe).collect(),
    }
}

pub fn author_context_relay_match_probe() -> AuthorContextRelayMatchProbe {
    let nearby_input = input(Some(1_700_000_010));
    let exact_input = input(None);
    AuthorContextRelayMatchProbe {
        older_same_author: author_context_event_matches_read(
            &nearby_input,
            &event(1_700_000_009, 2, 1),
        ),
        newer_same_author: author_context_event_matches_read(
            &nearby_input,
            &event(1_700_000_011, 3, 1),
        ),
        exact_anchor: author_context_event_matches_read(
            &exact_input,
            &event(1_700_000_010, 1, KIND_TEXT_NOTE),
        ),
        nearby_before_anchor: author_context_event_matches_read(
            &exact_input,
            &event(1_700_000_009, 2, KIND_TEXT_NOTE),
        ),
        wrong_author: author_context_event_matches_read(&nearby_input, &wrong_author_event()),
        unsupported_kind: author_context_event_matches_read(
            &nearby_input,
            &event(1_700_000_009, 4, 7),
        ),
        outside_window: author_context_event_matches_read(
            &nearby_input,
            &event(1_699_900_000, 5, 1),
        ),
    }
}

fn filter_probe(filter: &NostrFilter) -> AuthorContextRelayFilterProbe {
    AuthorContextRelayFilterProbe {
        ids: filter.ids.clone(),
        since: filter.since,
        until: filter.until,
        limit: filter.limit,
        authors: filter.authors.clone(),
        kinds: filter.kinds.clone(),
    }
}

fn input(anchor_created_at: Option<u64>) -> AuthorContextRelayReadInput {
    AuthorContextRelayReadInput {
        owner: "author-context-tab".to_owned(),
        event_id: id(1),
        author_pubkey: pubkey(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        author_routes: vec![lkjstr_relays::AuthorRelayRoute {
            author: pubkey(),
            relay_url: "wss://author-route.example".to_owned(),
            source: lkjstr_relays::RouteEvidenceSource::Nip65,
            score: 10,
        }],
        cache_window: reduce_feed_window(
            empty_feed_window(1, 180),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive()],
                flags: FeedWindowFlags::default(),
            },
        ),
        geometry_models: Vec::new(),
        diagnostics: Vec::new(),
        anchor_created_at,
        now_sec: 1_700_000_030,
    }
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "author-context".to_owned(),
        event: event(1_700_000_010, 1, KIND_TEXT_NOTE),
    }
}

fn wrong_author_event() -> NostrEvent {
    NostrEvent {
        pubkey: "b".repeat(64),
        ..event(1_700_000_009, 6, KIND_TEXT_NOTE)
    }
}

fn event(created_at: u64, value: u64, kind: u64) -> NostrEvent {
    NostrEvent {
        id: id(value),
        pubkey: pubkey(),
        created_at,
        kind,
        tags: Vec::new(),
        content: "author context relay event".to_owned(),
        sig: "f".repeat(128),
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey() -> String {
    "a".repeat(64)
}
