use lkjstr_app::{
    FeedScanHint, ScanDensityModel, ScanDirection, ScanModelKey, ScanModelScope, ScanSpanConfig,
    ScanWindowFeedback, SpanCapReason,
};

use super::dto::{ConfigDto, HintDto, ModelDto, PlanInputDto, ScanDirectionDto};

pub(super) fn direction_from_dto(direction: &ScanDirectionDto) -> ScanDirection {
    match direction {
        ScanDirectionDto::Older => ScanDirection::Older,
        ScanDirectionDto::Newer => ScanDirection::Newer,
    }
}

pub(super) fn direction_to_dto(direction: &ScanDirection) -> ScanDirectionDto {
    match direction {
        ScanDirection::Older => ScanDirectionDto::Older,
        ScanDirection::Newer => ScanDirectionDto::Newer,
    }
}

pub(super) fn model_from_dto(dto: ModelDto) -> Option<ScanDensityModel> {
    Some(ScanDensityModel {
        key: ScanModelKey {
            semantic_feed_key: dto.semantic_feed_key,
            route_group_key: dto.route_group_key,
            relay_url: dto.relay_url,
            semantic_filter_key: dto.semantic_filter_key,
            direction: direction_from_dto(&dto.direction),
            route_fingerprint: dto.route_fingerprint,
        },
        scope: scope_from_str(&dto.scope)?,
        density_events_per_second: dto.density_events_per_second,
        log_density_mean: dto.log_density_mean,
        log_density_variance: dto.log_density_variance,
        sample_weight: dto.sample_weight,
        complete_window_count: dto.complete_window_count,
        dense_window_count: dto.dense_window_count,
        sparse_window_count: dto.sparse_window_count,
        incomplete_window_count: dto.incomplete_window_count,
        failure_window_count: dto.failure_window_count,
        limit_hit_rate: dto.limit_hit_rate,
        incomplete_rate: dto.incomplete_rate,
        last_good_span_seconds: dto.last_good_span_seconds,
        last_proposed_span_seconds: dto.last_proposed_span_seconds,
        updated_at_ms: dto.updated_at_ms,
    })
}

pub(super) fn config_from_dto(dto: Option<ConfigDto>) -> ScanSpanConfig {
    let Some(dto) = dto else {
        return ScanSpanConfig::default();
    };
    let default = ScanSpanConfig::default();
    ScanSpanConfig {
        min_span_seconds: dto.min_span_seconds.unwrap_or(default.min_span_seconds),
        max_span_seconds: dto.max_span_seconds.unwrap_or(default.max_span_seconds),
        neutral_span_seconds: dto
            .neutral_span_seconds
            .unwrap_or(default.neutral_span_seconds),
        target_limit_numerator: dto
            .target_limit_numerator
            .unwrap_or(default.target_limit_numerator),
        target_limit_denominator: dto
            .target_limit_denominator
            .unwrap_or(default.target_limit_denominator),
        max_single_change_factor: dto
            .max_single_change_factor
            .unwrap_or(default.max_single_change_factor),
        stale_half_life_seconds: dto
            .stale_half_life_seconds
            .unwrap_or(default.stale_half_life_seconds),
        minimum_density_per_second: dto
            .minimum_density_per_second
            .unwrap_or(default.minimum_density_per_second),
    }
}

pub(super) fn hint_from_dto(input: &PlanInputDto, dto: &HintDto) -> FeedScanHint {
    FeedScanHint {
        semantic_feed_key: input.semantic_feed_key.clone(),
        route_group_key: input.route_group_key.clone(),
        relay_url: input.relay_url.clone(),
        semantic_filter_key: input.semantic_filter_key.clone(),
        direction: direction_from_dto(&input.direction),
        route_fingerprint: input.route_fingerprint.clone(),
        current_span_seconds: dto.next_span_seconds,
        next_span_seconds: dto.next_span_seconds,
        min_span_seconds: 1,
        max_span_seconds: u64::MAX,
        last_feedback: ScanWindowFeedback::Balanced,
        density_ewma: 0.0,
        complete_window_count: 0,
        dense_window_count: 0,
        incomplete_window_count: 0,
        last_since: 0,
        last_until: 0,
        updated_at_seconds: input.now_seconds,
        expires_at_seconds: input.now_seconds.saturating_add(1),
    }
}

pub(super) fn scope_to_string(scope: &ScanModelScope) -> String {
    match scope {
        ScanModelScope::Exact => "Exact",
        ScanModelScope::RouteGroup => "RouteGroup",
        ScanModelScope::RelayFilter => "RelayFilter",
        ScanModelScope::SurfaceFilter => "SurfaceFilter",
        ScanModelScope::Surface => "Surface",
        ScanModelScope::Global => "Global",
        ScanModelScope::Neutral => "Neutral",
    }
    .to_owned()
}

pub(super) fn cap_to_string(reason: &SpanCapReason) -> String {
    match reason {
        SpanCapReason::IncreaseLimited => "increase-limited",
        SpanCapReason::DecreaseLimited => "decrease-limited",
        SpanCapReason::MinSpan => "min-span",
        SpanCapReason::MaxSpan => "max-span",
    }
    .to_owned()
}

fn scope_from_str(value: &str) -> Option<ScanModelScope> {
    Some(match value {
        "Exact" => ScanModelScope::Exact,
        "RouteGroup" => ScanModelScope::RouteGroup,
        "RelayFilter" => ScanModelScope::RelayFilter,
        "SurfaceFilter" => ScanModelScope::SurfaceFilter,
        "Surface" => ScanModelScope::Surface,
        "Global" => ScanModelScope::Global,
        "Neutral" => ScanModelScope::Neutral,
        _ => return None,
    })
}
