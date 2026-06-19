#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use std::sync::{Arc, Mutex};

use lkjstr_app::feed::{
    FeedEventContent, FeedEventContentRow, FeedEventReferenceKind, FeedEventReferenceUnavailable,
    FeedEventRow, FeedEventUnavailablePreview,
};
use lkjstr_app::{
    EventDisplayContext, EventDisplayInput, FeedFooterState, FeedViewModel, FeedViewRow,
    GeometryEstimateSource, HomeFeedStatus, HomeFeedView, RowGeometryEstimate, StartupInput,
    default_recovery_ids, feed_event_row_id, footer_row, plan_event_display,
};
use lkjstr_protocol::KIND_TEXT_NOTE;
use lkjstr_ui::{HomeFeedProvider, HomeFeedRequest};
use wasm_bindgen::prelude::JsValue;

#[derive(Clone)]
pub struct CapturedHomeRequest {
    inner: Arc<Mutex<Option<HomeFeedRequest>>>,
}

pub struct CapturedComplete {
    request: HomeFeedRequest,
}

impl Default for CapturedHomeRequest {
    fn default() -> Self {
        Self::new()
    }
}

impl CapturedHomeRequest {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }

    pub fn provider(&self) -> HomeFeedProvider {
        let captured = self.inner.clone();
        HomeFeedProvider::new(move |request| {
            replace_request(&captured, request.clone());
            request.complete(home_model(false));
        })
    }

    pub fn request(&self) -> Result<CapturedComplete, JsValue> {
        let guard = self
            .inner
            .lock()
            .map_err(|_| js_error("Home request capture poisoned"))?;
        let request = guard
            .as_ref()
            .cloned()
            .ok_or_else(|| js_error("missing Home provider request"))?;
        Ok(CapturedComplete { request })
    }
}

impl CapturedComplete {
    pub fn complete(&self) {
        self.request.complete(home_model(true));
    }
}

fn replace_request(captured: &Arc<Mutex<Option<HomeFeedRequest>>>, request: HomeFeedRequest) {
    match captured.lock() {
        Ok(mut slot) => {
            slot.replace(request);
        }
        Err(poisoned) => {
            poisoned.into_inner().replace(request);
        }
    }
}

fn home_model(hydrated: bool) -> HomeFeedView {
    HomeFeedView {
        status: HomeFeedStatus::Ready,
        live_query: None,
        view_model: FeedViewModel {
            feed_id: "home-reference-hydration".to_owned(),
            rows: vec![
                reference_event(hydrated),
                text_event(20, "visible anchor event"),
                text_event(10, &"below anchor filler ".repeat(90)),
                FeedViewRow::Footer(footer_row(
                    "home-reference-hydration",
                    FeedFooterState::CacheHit,
                )),
            ],
        },
    }
}

fn reference_event(hydrated: bool) -> FeedViewRow {
    let rows = if hydrated {
        hydrated_reference_rows()
    } else {
        vec![
            FeedEventContentRow::Text("reference carrier".to_owned()),
            FeedEventContentRow::ReferencePreviewUnavailable(FeedEventUnavailablePreview {
                row_key: "reference-preview-segment".to_owned(),
                segment_index: 0,
            }),
        ]
    };
    event_row_model(30, FeedEventContent::Rows(rows))
}

fn hydrated_reference_rows() -> Vec<FeedEventContentRow> {
    let mut rows = vec![FeedEventContentRow::Text("reference carrier".to_owned())];
    for index in 0..12 {
        rows.push(FeedEventContentRow::ReferenceUnavailable(
            FeedEventReferenceUnavailable {
                row_key: format!("reference-hydrated-{index}"),
                segment_index: index,
                event_id: id(100 + u64::from(index)),
                kind: FeedEventReferenceKind::NostrEvent,
                relays: vec!["wss://selected.example".to_owned()],
            },
        ));
    }
    rows
}

fn text_event(value: u64, text: &str) -> FeedViewRow {
    event_row_model(
        value,
        FeedEventContent::Rows(vec![FeedEventContentRow::Text(text.to_owned())]),
    )
}

fn event_row_model(value: u64, content: FeedEventContent) -> FeedViewRow {
    let event_id = id(value);
    FeedViewRow::Event(FeedEventRow {
        row_id: feed_event_row_id(&event_id),
        event_id: event_id.clone(),
        author_pubkey: pubkey("b"),
        created_at: 1_700_000_000 + value,
        event_kind: KIND_TEXT_NOTE,
        relay_provenance: vec!["wss://selected.example".to_owned()],
        display: plan_event_display(&EventDisplayInput {
            event_id: Some(event_id.clone()),
            event_kind: Some(KIND_TEXT_NOTE),
            content_shape_hash: Some(format!("shape-{value}")),
            context: EventDisplayContext::Timeline,
            target_available: true,
        }),
        content,
        geometry_estimate: RowGeometryEstimate {
            key: feed_event_row_id(&event_id),
            estimated_height_px: 120,
            confidence: 0.25,
            source: GeometryEstimateSource::FeatureFormula,
        },
        has_content_warning: false,
        content_warning_reason: None,
        custom_emoji_count: 0,
    })
}

pub fn startup() -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
