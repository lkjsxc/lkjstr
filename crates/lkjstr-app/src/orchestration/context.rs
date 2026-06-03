use super::evidence::{CoverageEvidenceState, OptimizerEvidenceState};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SurfaceKind {
    Home,
    Global,
    Profile,
    Notifications,
    Thread,
    Search,
    CustomRequest,
    AuthorContext,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OrchestrationContext {
    pub surface: SurfaceKind,
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub coverage: CoverageEvidenceState,
    pub optimizer: OptimizerEvidenceState,
    pub visible_owner: bool,
    pub visible_row_count: usize,
    pub storage_pressure: f64,
    pub now_ms: u64,
}

impl OrchestrationContext {
    #[must_use]
    pub fn enabled_selected_relays(&self) -> Vec<String> {
        self.selected_relays
            .iter()
            .filter(|relay| !self.disabled_relays.contains(relay))
            .cloned()
            .collect()
    }
}
