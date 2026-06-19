use lkjstr_app::{
    CustomRequestFeedSourceState, CustomRequestFeedView, CustomRequestFeedViewInput,
    CustomRequestRunInput, CustomRequestRunPlan, CustomRequestRunStatus, FeedFragmentConfig,
    build_custom_request_feed_view, empty_feed_window, plan_custom_request_run,
};
use lkjstr_domain::seed_relay_sets;
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::CustomRequestProvider;

use crate::{
    custom_request_relay_input::{CustomRequestRelayInputSeed, custom_request_relay_input},
    custom_request_relay_limits::custom_request_relay_limits,
    custom_request_relay_model::model_from_input,
    custom_request_relay_read::start_custom_request_relay_read,
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store, sqlite_store::sqlite_relay_sets_all,
};

const PAGE_SIZE: u64 = 30;
const WINDOW_MAX: usize = 180;
const VIEW_WIDTH_PX: u16 = 680;
const VIEW_FONT_SCALE: f32 = 1.0;
const RELAY_OUTPUT_UNAVAILABLE: &str = "Custom Request relay output is unavailable.";

pub fn custom_request_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> CustomRequestProvider {
    CustomRequestProvider::new(move |request| {
        let db_name = db_name.clone();
        let worker_url = worker_url.clone();
        let relay_slot = RelayReadSlot::default();
        let release_slot = relay_slot.clone();
        request.lease().on_release(move || release_slot.cancel());
        wasm_bindgen_futures::spawn_local(async move {
            if request.is_released() {
                return;
            }
            let selected_relays = selected_relays(&db_name, &worker_url).await;
            if request.is_released() {
                return;
            }
            let plan = custom_request_plan(
                &db_name,
                &worker_url,
                request.owner.clone(),
                request.raw_json.clone(),
                selected_relays,
            )
            .await;
            let geometry_models = Vec::new();
            let Some(relay_input) = custom_request_relay_input(CustomRequestRelayInputSeed {
                owner: &request.owner,
                db_name: &db_name,
                worker_url: &worker_url,
                plan: plan.clone(),
                geometry_models: &geometry_models,
            }) else {
                request.complete(local_view_from_plan(request.owner.clone(), plan));
                return;
            };
            request.complete(model_from_input(
                &relay_input,
                CustomRequestFeedSourceState::RelayProgressive,
            ));
            if request.is_released() {
                return;
            }
            let read_request = request.clone();
            let handle = start_custom_request_relay_read(relay_input, move |output| {
                read_request.complete(output.model);
            });
            relay_slot.replace(handle);
        });
    })
}

async fn custom_request_plan(
    db_name: &str,
    worker_url: &str,
    owner: String,
    raw_json: String,
    selected_relays: Vec<String>,
) -> CustomRequestRunPlan {
    let plan = plan_custom_request_run(run_input(
        owner.clone(),
        raw_json.clone(),
        selected_relays.clone(),
    ));
    if plan.status != CustomRequestRunStatus::Ready {
        return plan;
    }
    let limits = custom_request_relay_limits(db_name, worker_url, &plan.relays).await;
    if limits.is_empty() {
        return plan;
    }
    lkjstr_app::custom_request::plan_custom_request_run_with_relay_limits(
        run_input(owner, raw_json, selected_relays),
        limits,
    )
}

fn run_input(
    owner: String,
    raw_json: String,
    selected_relays: Vec<String>,
) -> CustomRequestRunInput {
    CustomRequestRunInput {
        owner,
        visibility: DemandVisibility::Visible,
        selected_relays,
        disabled_relays: Vec::new(),
        raw_json,
        now_sec: browser_now_ms() / 1_000,
        page_size: PAGE_SIZE,
    }
}

async fn selected_relays(db_name: &str, worker_url: &str) -> Vec<String> {
    let now = browser_now_ms();
    match with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_relay_sets_all(&store).await
    })
    .await
    {
        StorageOutcome::Ok(rows) => selected_read_relays(&seed_relay_sets(&rows, now)),
        _ => Vec::new(),
    }
}

fn local_view_from_plan(owner: String, plan: CustomRequestRunPlan) -> CustomRequestFeedView {
    let source_state = match plan.status {
        CustomRequestRunStatus::Ready => CustomRequestFeedSourceState::Partial {
            reason: RELAY_OUTPUT_UNAVAILABLE.to_owned(),
            retry_available: false,
        },
        CustomRequestRunStatus::Invalid | CustomRequestRunStatus::NoRelay => {
            CustomRequestFeedSourceState::Complete
        }
    };
    build_custom_request_feed_view(CustomRequestFeedViewInput {
        owner,
        run_plan: Some(plan),
        source_state,
        window: empty_feed_window(1, WINDOW_MAX),
        width_px: VIEW_WIDTH_PX,
        font_scale: VIEW_FONT_SCALE,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
    })
}
