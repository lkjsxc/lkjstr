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
    host_status::browser_now_ms, relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store, sqlite_store::sqlite_relay_sets_all,
};

const PAGE_SIZE: u64 = 30;
const WINDOW_MAX: usize = 180;
const VIEW_WIDTH_PX: u16 = 680;
const VIEW_FONT_SCALE: f32 = 1.0;
const RELAY_OUTPUT_GAP: &str = "Rust Custom Request relay result output is not wired yet.";

pub fn custom_request_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> CustomRequestProvider {
    CustomRequestProvider::new(move |request| {
        let db_name = db_name.clone();
        let worker_url = worker_url.clone();
        wasm_bindgen_futures::spawn_local(async move {
            if request.is_released() {
                return;
            }
            let selected_relays = selected_relays(&db_name, &worker_url).await;
            if request.is_released() {
                return;
            }
            let plan = plan_custom_request_run(CustomRequestRunInput {
                owner: request.owner.clone(),
                visibility: DemandVisibility::Visible,
                selected_relays,
                disabled_relays: Vec::new(),
                raw_json: request.raw_json.clone(),
                now_sec: browser_now_ms() / 1_000,
                page_size: PAGE_SIZE,
            });
            request.complete(view_from_plan(request.owner.clone(), plan));
        });
    })
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

fn view_from_plan(owner: String, plan: CustomRequestRunPlan) -> CustomRequestFeedView {
    let source_state = match plan.status {
        CustomRequestRunStatus::Ready => CustomRequestFeedSourceState::Partial {
            reason: RELAY_OUTPUT_GAP.to_owned(),
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
