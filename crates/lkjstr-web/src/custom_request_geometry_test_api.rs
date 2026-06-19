use lkjstr_app::{
    CustomRequestRunInput, EventDisplayContext, FeedViewRow, GeometryEstimateSource,
    RowGeometryModel, feed_event_geometry_model_keys, plan_custom_request_run,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    DemandVisibility, PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot,
    ProgressiveReadStatus,
};

use crate::{
    custom_request_relay_input::{CustomRequestRelayInputSeed, custom_request_relay_input},
    custom_request_relay_model::{output_from_snapshot_with_geometry, window_from_snapshot},
};

pub struct CustomRequestGeometryProbe {
    pub estimated_height_px: u16,
    pub source: GeometryEstimateSource,
}

pub fn custom_request_geometry_probe() -> Option<CustomRequestGeometryProbe> {
    let input = custom_request_relay_input(CustomRequestRelayInputSeed {
        owner: "custom-tab",
        db_name: "custom-request-geometry-test",
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
    })?;
    let snapshot = snapshot();
    let window = window_from_snapshot(&input, &snapshot);
    let key = feed_event_geometry_model_keys(&window, EventDisplayContext::CustomRequest, 680, 1.0)
        .into_iter()
        .next()?;
    let output = output_from_snapshot_with_geometry(
        &input,
        snapshot,
        vec![RowGeometryModel {
            bucket_key: key,
            average_height_px: 577,
            sample_count: 11,
            updated_at_ms: 12,
        }],
    );
    output.model.view_model.rows.into_iter().find_map(|row| {
        if let FeedViewRow::Event(row) = row {
            Some(CustomRequestGeometryProbe {
                estimated_height_px: row.geometry_estimate.estimated_height_px,
                source: row.geometry_estimate.source,
            })
        } else {
            None
        }
    })
}

fn snapshot() -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "custom-request".to_owned(),
        surface: Some(PageReadSurface::CustomRequest),
        status: ProgressiveReadStatus::Complete,
        reason: "relay-final".to_owned(),
        events: vec![progressive()],
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
        event: NostrEvent {
            id: id(15),
            pubkey: pubkey("a"),
            created_at: 15,
            kind: KIND_TEXT_NOTE,
            tags: vec![vec!["e".to_owned(), id(7)]],
            content: "custom request relay event".to_owned(),
            sig: "c".repeat(128),
        },
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
