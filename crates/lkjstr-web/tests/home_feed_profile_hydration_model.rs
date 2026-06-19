#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use std::sync::{Arc, Mutex};

use lkjstr_app::{
    FeedFooterState, FeedFragmentConfig, FeedProfileRow, FeedViewModel, FeedViewRow,
    FeedWindowEvidence, FeedWindowFlags, HomeFeedSourceState, HomeFeedStatus, HomeFeedView,
    HomeFeedViewInput, HomeFollowState, RowGeometryModel, StartupInput, build_home_feed_view,
    default_recovery_ids, empty_feed_window, feed_profile_row_id, footer_row, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
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
            request.complete(home_model("pending profile"));
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
    pub fn complete(&self, profile_name: String) {
        self.request.complete(home_model(&profile_name));
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

fn home_model(profile_name: &str) -> HomeFeedView {
    let mut rows = Vec::new();
    rows.push(profile_row(profile_name));
    rows.extend(event_rows());
    rows.push(FeedViewRow::Footer(footer_row(
        "home-profile-hydration",
        FeedFooterState::CacheHit,
    )));
    HomeFeedView {
        status: HomeFeedStatus::Ready,
        live_query: None,
        view_model: FeedViewModel {
            feed_id: "home-profile-hydration".to_owned(),
            rows,
        },
    }
}

fn profile_row(display_name: &str) -> FeedViewRow {
    FeedViewRow::Profile(FeedProfileRow {
        row_id: feed_profile_row_id(&pubkey("p")),
        pubkey: pubkey("p"),
        display_name: display_name.to_owned(),
    })
}

fn event_rows() -> Vec<FeedViewRow> {
    build_home_feed_view(HomeFeedViewInput {
        owner: "home-profile-hydration".to_owned(),
        active_pubkey: Some(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::CacheComplete,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_040,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 240),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![event(20, "visible anchor event"), event(10, &below_text())],
                flags: FeedWindowFlags::default(),
            },
        ),
        width_px: 260,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
    .view_model
    .rows
    .into_iter()
    .filter(|row| matches!(row, FeedViewRow::Event(_)))
    .collect()
}

fn event(value: u64, content: &str) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("b"),
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: content.to_owned(),
            sig: "d".repeat(128),
        },
    }
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

pub fn hydrated_profile_name() -> String {
    format!(
        "{}hydrated-profile-tail",
        "hydrated profile name ".repeat(36)
    )
}

fn below_text() -> String {
    "below anchor filler ".repeat(80)
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
