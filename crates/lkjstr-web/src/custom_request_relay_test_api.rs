use lkjstr_app::{
    CustomRequestFeedStatus, CustomRequestRunInput, FeedFooterState, FeedViewRow,
    plan_custom_request_run,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    DemandVisibility, PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot,
    ProgressiveReadStatus,
};

use crate::{
    custom_request_relay_input::{
        CustomRequestRelayInputSeed, custom_request_event_matches_read, custom_request_relay_input,
    },
    custom_request_relay_model::output_from_snapshot,
};

pub struct CustomRequestRelayPlanProbe {
    pub sub_id: String,
    pub relays: Vec<String>,
    pub kinds: Option<Vec<u64>>,
    pub authors: Option<Vec<String>>,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub e_tags: Option<Vec<String>>,
    pub limit: Option<u64>,
}

pub struct CustomRequestRelayMatchProbe {
    pub accepted: bool,
    pub wrong_author: bool,
    pub missing_tag: bool,
    pub wrong_kind: bool,
}

pub struct CustomRequestRelayOutputProbe {
    pub status: CustomRequestFeedStatus,
    pub footer: Option<FeedFooterState>,
    pub event_count: usize,
    pub partial_detail: Option<String>,
    pub first_event_id: Option<String>,
}

pub fn relay_plan_probe() -> Option<CustomRequestRelayPlanProbe> {
    let input = relay_input()?;
    let filter = input.filters.first()?;
    Some(CustomRequestRelayPlanProbe {
        sub_id: input.sub_id,
        relays: input.relays,
        kinds: filter.kinds.clone(),
        authors: filter.authors.clone(),
        since: filter.since,
        until: filter.until,
        e_tags: filter.tags.get("e").cloned(),
        limit: filter.limit,
    })
}

pub fn relay_match_probe() -> Option<CustomRequestRelayMatchProbe> {
    let input = relay_input()?;
    Some(CustomRequestRelayMatchProbe {
        accepted: custom_request_event_matches_read(&input, &event(15, "a", KIND_TEXT_NOTE, true)),
        wrong_author: custom_request_event_matches_read(&input, &event(15, "b", KIND_TEXT_NOTE, true)),
        missing_tag: custom_request_event_matches_read(&input, &event(15, "a", KIND_TEXT_NOTE, false)),
        wrong_kind: custom_request_event_matches_read(&input, &event(15, "a", 7, true)),
    })
}

pub fn complete_output_probe() -> Option<CustomRequestRelayOutputProbe> {
    let input = relay_input()?;
    let output = output_from_snapshot(
        &input,
        snapshot(
            ProgressiveReadStatus::Complete,
            "relay-final",
            vec![progressive()],
        ),
    );
    Some(output_probe(output.model))
}

pub fn failed_empty_output_probe() -> Option<CustomRequestRelayOutputProbe> {
    let input = relay_input()?;
    let output = output_from_snapshot(
        &input,
        snapshot(ProgressiveReadStatus::Failed, "relay-error", Vec::new()),
    );
    Some(output_probe(output.model))
}

fn relay_input() -> Option<crate::custom_request_relay_input::CustomRequestRelayReadInput> {
    custom_request_relay_input(CustomRequestRelayInputSeed {
        owner: "custom-tab",
        db_name: "custom-request-test",
        worker_url: "/worker.js",
        plan: plan_custom_request_run(CustomRequestRunInput {
            owner: "custom-tab".to_owned(),
            visibility: DemandVisibility::Visible,
            selected_relays: vec!["wss://selected.example".to_owned()],
            disabled_relays: Vec::new(),
            raw_json: raw_request(),
            now_sec: 20,
            page_size: 30,
        }),
        geometry_models: &[],
    })
}

fn output_probe(model: lkjstr_app::CustomRequestFeedView) -> CustomRequestRelayOutputProbe {
    let mut event_count = 0;
    let mut first_event_id = None;
    let mut partial_detail = None;
    let mut footer = None;
    for row in model.view_model.rows {
        match row {
            FeedViewRow::Event(row) => {
                event_count += 1;
                first_event_id.get_or_insert(row.event_id);
            }
            FeedViewRow::Unavailable(row) if row.reason == "custom-request-partial" => {
                partial_detail = Some(row.detail);
            }
            FeedViewRow::Footer(row) => footer = Some(row.state),
            _ => {}
        }
    }
    CustomRequestRelayOutputProbe {
        status: model.status,
        footer,
        event_count,
        partial_detail,
        first_event_id,
    }
}

fn snapshot(
    status: ProgressiveReadStatus,
    reason: &str,
    events: Vec<ProgressiveEvent>,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "custom-request".to_owned(),
        surface: Some(PageReadSurface::CustomRequest),
        status,
        reason: reason.to_owned(),
        events,
        relays: Vec::new(),
        started_at_ms: 1,
        updated_at_ms: 2,
        duration_ms: 1,
        final_read: true,
    }
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://explicit.example/".to_owned()],
        sub_id: "custom-request".to_owned(),
        event: event(15, "a", KIND_TEXT_NOTE, true),
    }
}

fn event(created_at: u64, author: &str, kind: u64, target_tag: bool) -> NostrEvent {
    NostrEvent {
        id: id(created_at),
        pubkey: pubkey(author),
        created_at,
        kind,
        tags: if target_tag {
            vec![vec!["e".to_owned(), id(7)]]
        } else {
            Vec::new()
        },
        content: "custom request relay event".to_owned(),
        sig: "c".repeat(128),
    }
}

fn raw_request() -> String {
    format!(
        r##"{{"filter":{{"kinds":[1],"authors":["{}"],"since":10,"until":20,"#e":["{}"],"limit":30}},"relays":["wss://explicit.example"]}}"##,
        pubkey("a"),
        id(7)
    )
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
