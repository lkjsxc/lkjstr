use lkjstr_app::{
    CustomRequestFeedSourceState, CustomRequestFeedView, CustomRequestFeedViewInput,
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, build_custom_request_feed_view,
    reduce_feed_window,
};
use lkjstr_relays::{ProgressiveReadSnapshot, ProgressiveReadStatus};

use crate::custom_request_relay_input::CustomRequestRelayReadInput;

const VIEW_WIDTH_PX: u16 = 680;
const VIEW_FONT_SCALE: f32 = 1.0;

#[derive(Clone)]
pub(crate) struct CustomRequestRelayReadOutput {
    pub(crate) model: CustomRequestFeedView,
}

pub(crate) fn model_from_input(
    input: &CustomRequestRelayReadInput,
    source_state: CustomRequestFeedSourceState,
) -> CustomRequestFeedView {
    build_model(input.owner.clone(), input.plan.clone(), source_state, input.cache_window.clone())
}

pub(crate) fn output_from_snapshot(
    input: &CustomRequestRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> CustomRequestRelayReadOutput {
    let source_state = source_state(&snapshot);
    let window = reduce_feed_window(
        input.cache_window.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot,
            flags: FeedWindowFlags::default(),
        },
    );
    let model = build_model(input.owner.clone(), input.plan.clone(), source_state, window);
    CustomRequestRelayReadOutput { model }
}

fn build_model(
    owner: String,
    plan: lkjstr_app::CustomRequestRunPlan,
    source_state: CustomRequestFeedSourceState,
    window: lkjstr_app::FeedWindowState,
) -> CustomRequestFeedView {
    build_custom_request_feed_view(CustomRequestFeedViewInput {
        owner,
        run_plan: Some(plan),
        source_state,
        window,
        width_px: VIEW_WIDTH_PX,
        font_scale: VIEW_FONT_SCALE,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
    })
}

fn source_state(snapshot: &ProgressiveReadSnapshot) -> CustomRequestFeedSourceState {
    match snapshot.status {
        ProgressiveReadStatus::Complete => CustomRequestFeedSourceState::Complete,
        ProgressiveReadStatus::Failed
        | ProgressiveReadStatus::Cancelled
        | ProgressiveReadStatus::Incomplete => CustomRequestFeedSourceState::Partial {
            reason: snapshot.reason.clone(),
            retry_available: true,
        },
        _ => CustomRequestFeedSourceState::RelayProgressive,
    }
}
