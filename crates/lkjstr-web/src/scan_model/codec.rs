use lkjstr_app::{
    CoverageGap, CursorPoint, FeedScanPlanInput, ScanDensityModel, ScanModelContext, ScanModelKey,
    ScanModelScope, ScanSegment, ScanSegmentObservation, SpanProposal,
};

use super::codec_helpers::{
    cap_to_string, config_from_dto, direction_from_dto, direction_to_dto, hint_from_dto,
    model_from_dto, scope_to_string,
};
use super::dto::{ContextDto, ModelDto, ObservationDto, PlanInputDto, ProposalDto, SegmentDto};

pub fn context_from_dto(dto: &ContextDto) -> ScanModelContext {
    ScanModelContext {
        semantic_feed_key: dto.semantic_feed_key.clone(),
        route_group_key: dto.route_group_key.clone(),
        relay_url: dto.relay_url.clone(),
        semantic_filter_key: dto.semantic_filter_key.clone(),
        direction: direction_from_dto(&dto.direction),
        route_fingerprint: dto.route_fingerprint.clone(),
    }
}

pub fn plan_input_from_dto(dto: PlanInputDto) -> FeedScanPlanInput {
    let previous_hint = dto
        .previous_hint
        .as_ref()
        .map(|hint| hint_from_dto(&dto, hint));
    FeedScanPlanInput {
        semantic_feed_key: dto.semantic_feed_key.clone(),
        route_group_key: dto.route_group_key.clone(),
        relay_url: dto.relay_url.clone(),
        semantic_filter_key: dto.semantic_filter_key.clone(),
        direction: direction_from_dto(&dto.direction),
        route_fingerprint: dto.route_fingerprint.clone(),
        visible_edge: CursorPoint::new(
            dto.visible_edge.created_at_seconds,
            dto.visible_edge.event_id,
        ),
        now_seconds: dto.now_seconds,
        page_size: dto.page_size,
        requested_limit: dto.requested_limit,
        effective_limit: dto.effective_limit,
        previous_hint,
        scan_models: dto
            .scan_models
            .into_iter()
            .filter_map(model_from_dto)
            .collect(),
        span_config: config_from_dto(dto.config),
        coverage_gaps: Vec::<CoverageGap>::new(),
    }
}

pub fn observation_from_dto(dto: ObservationDto) -> ScanSegmentObservation {
    ScanSegmentObservation {
        semantic_feed_key: dto.semantic_feed_key,
        route_group_key: dto.route_group_key,
        relay_url: dto.relay_url,
        semantic_filter_key: dto.semantic_filter_key,
        direction: direction_from_dto(&dto.direction),
        route_fingerprint: dto.route_fingerprint,
        since_seconds: dto.since_seconds,
        until_seconds: dto.until_seconds,
        requested_limit: dto.requested_limit,
        effective_limit: dto.effective_limit,
        event_count: dto.event_count,
        unique_event_count: dto.unique_event_count,
        final_visible_count: dto.final_visible_count,
        event_limit_reached: dto.event_limit_reached,
        eose: dto.eose,
        timeout: dto.timeout,
        closed: dto.closed,
        auth: dto.auth,
        socket_error: dto.socket_error,
        bytes_sent: dto.bytes_sent,
        bytes_received: dto.bytes_received,
        started_at_ms: dto.started_at_ms,
        completed_at_ms: dto.completed_at_ms,
    }
}

pub fn proposal_to_dto(proposal: &SpanProposal) -> ProposalDto {
    ProposalDto {
        span_seconds: proposal.span_seconds,
        target_count: proposal.target_count,
        effective_limit: proposal.effective_limit,
        estimated_density_events_per_second: proposal.estimated_density_events_per_second,
        source_scope: scope_to_string(&proposal.source_scope),
        confidence: proposal.confidence,
        cap_applied: proposal.cap_applied.as_ref().map(cap_to_string),
        diagnostics: proposal
            .diagnostics
            .iter()
            .map(|item| item.message.clone())
            .collect(),
    }
}

pub fn segment_to_dto(segment: &ScanSegment) -> SegmentDto {
    SegmentDto {
        since_seconds: segment.since_seconds,
        until_seconds: segment.until_seconds,
        span_seconds: segment.span_seconds,
    }
}

pub fn model_to_dto(model: &ScanDensityModel) -> ModelDto {
    ModelDto {
        semantic_feed_key: model.key.semantic_feed_key.clone(),
        route_group_key: model.key.route_group_key.clone(),
        relay_url: model.key.relay_url.clone(),
        semantic_filter_key: model.key.semantic_filter_key.clone(),
        direction: direction_to_dto(&model.key.direction),
        route_fingerprint: model.key.route_fingerprint.clone(),
        scope: scope_to_string(&model.scope),
        density_events_per_second: model.density_events_per_second,
        log_density_mean: model.log_density_mean,
        log_density_variance: model.log_density_variance,
        sample_weight: model.sample_weight,
        complete_window_count: model.complete_window_count,
        dense_window_count: model.dense_window_count,
        sparse_window_count: model.sparse_window_count,
        incomplete_window_count: model.incomplete_window_count,
        failure_window_count: model.failure_window_count,
        limit_hit_rate: model.limit_hit_rate,
        incomplete_rate: model.incomplete_rate,
        last_good_span_seconds: model.last_good_span_seconds,
        last_proposed_span_seconds: model.last_proposed_span_seconds,
        updated_at_ms: model.updated_at_ms,
    }
}

pub fn key_to_dto(key: &ScanModelKey, scope: &ScanModelScope) -> ModelDto {
    model_to_dto(&ScanDensityModel {
        key: key.clone(),
        scope: scope.clone(),
        density_events_per_second: 0.0,
        log_density_mean: 0.0,
        log_density_variance: 0.0,
        sample_weight: 0.0,
        complete_window_count: 0,
        dense_window_count: 0,
        sparse_window_count: 0,
        incomplete_window_count: 0,
        failure_window_count: 0,
        limit_hit_rate: 0.0,
        incomplete_rate: 0.0,
        last_good_span_seconds: 0,
        last_proposed_span_seconds: 0,
        updated_at_ms: 0,
    })
}
