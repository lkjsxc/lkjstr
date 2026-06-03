use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScanDirectionDto {
    Older,
    Newer,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct CursorDto {
    pub created_at_seconds: u64,
    pub event_id: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct PlanInputDto {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirectionDto,
    pub route_fingerprint: String,
    pub visible_edge: CursorDto,
    pub now_seconds: u64,
    pub page_size: u16,
    pub requested_limit: u16,
    pub effective_limit: u16,
    pub previous_hint: Option<HintDto>,
    pub scan_models: Vec<ModelDto>,
    pub config: Option<ConfigDto>,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ReduceInputDto {
    pub plan: PlanInputDto,
    pub observation: ObservationDto,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ContextDto {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirectionDto,
    pub route_fingerprint: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ConfigDto {
    pub min_span_seconds: Option<u64>,
    pub max_span_seconds: Option<u64>,
    pub neutral_span_seconds: Option<u64>,
    pub target_limit_numerator: Option<u32>,
    pub target_limit_denominator: Option<u32>,
    pub max_single_change_factor: Option<f64>,
    pub stale_half_life_seconds: Option<u64>,
    pub minimum_density_per_second: Option<f64>,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ModelDto {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirectionDto,
    pub route_fingerprint: String,
    pub scope: String,
    pub density_events_per_second: f64,
    pub log_density_mean: f64,
    pub log_density_variance: f64,
    pub sample_weight: f64,
    pub complete_window_count: u64,
    pub dense_window_count: u64,
    pub sparse_window_count: u64,
    pub incomplete_window_count: u64,
    pub failure_window_count: u64,
    pub limit_hit_rate: f64,
    pub incomplete_rate: f64,
    pub last_good_span_seconds: u64,
    pub last_proposed_span_seconds: u64,
    pub updated_at_ms: u64,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ObservationDto {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirectionDto,
    pub route_fingerprint: String,
    pub since_seconds: u64,
    pub until_seconds: u64,
    pub requested_limit: u16,
    pub effective_limit: u16,
    pub event_count: u16,
    pub unique_event_count: u16,
    pub final_visible_count: u16,
    pub event_limit_reached: bool,
    pub eose: bool,
    pub timeout: bool,
    pub closed: bool,
    pub auth: bool,
    pub socket_error: bool,
    pub bytes_sent: u32,
    pub bytes_received: u32,
    pub started_at_ms: u64,
    pub completed_at_ms: u64,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct HintDto {
    pub next_span_seconds: u64,
}

#[derive(Clone, Serialize)]
pub struct SegmentDto {
    pub since_seconds: u64,
    pub until_seconds: u64,
    pub span_seconds: u64,
}

#[derive(Clone, Serialize)]
pub struct ProposalDto {
    pub span_seconds: u64,
    pub target_count: u16,
    pub effective_limit: u16,
    pub estimated_density_events_per_second: f64,
    pub source_scope: String,
    pub confidence: f64,
    pub cap_applied: Option<String>,
    pub diagnostics: Vec<String>,
}
