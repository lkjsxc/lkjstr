use lkjstr_app::{
    AnchorConfidence, FeedFragmentConfig, FeedScrollAnchor, GeometryEstimateSource,
    MaterializationTier, MeasuredFeedRow, RowGeometryFeatures, RowGeometryModel,
    RowHeightObservation, RowKind, SemanticFeedEvent,
};

use super::dto::{
    AnchorDto, EstimateOutputDto, FeaturesDto, FragmentConfigDto, ModelDto, ObservationDto, RowDto,
};

pub fn features_from_dto(dto: FeaturesDto) -> RowGeometryFeatures {
    RowGeometryFeatures {
        row_kind: row_kind_from_str(&dto.row_kind),
        event_kind: dto.event_kind,
        content_length: dto.content_length,
        unicode_scalar_count: dto.unicode_scalar_count,
        line_break_count: dto.line_break_count,
        longest_unbroken_token_length: dto.longest_unbroken_token_length,
        url_count: dto.url_count,
        media_count: dto.media_count,
        reference_preview_count: dto.reference_preview_count,
        custom_emoji_count: dto.custom_emoji_count,
        has_content_warning: dto.has_content_warning,
        has_profile_summary: dto.has_profile_summary,
        has_notification_chrome: dto.has_notification_chrome,
        has_action_bar: dto.has_action_bar,
        width_bucket: dto.width_bucket,
        font_scale_bucket: dto.font_scale_bucket,
        content_shape_hash: dto.content_shape_hash,
        materialization_tier: materialization_tier_from_str(&dto.materialization_tier),
    }
}

pub fn model_from_dto(dto: ModelDto) -> RowGeometryModel {
    RowGeometryModel {
        bucket_key: dto.bucket_key,
        average_height_px: dto.average_height_px,
        sample_count: dto.sample_count,
        updated_at_ms: dto.updated_at_ms,
    }
}

pub fn observation_from_dto(dto: ObservationDto) -> RowHeightObservation {
    RowHeightObservation {
        key: dto.key,
        features: features_from_dto(dto.features),
        measured_height_px: dto.measured_height_px,
        width_px: dto.width_px,
        observed_at_ms: dto.observed_at_ms,
    }
}

pub fn model_to_dto(model: &RowGeometryModel) -> ModelDto {
    ModelDto {
        bucket_key: model.bucket_key.clone(),
        average_height_px: model.average_height_px,
        sample_count: model.sample_count,
        updated_at_ms: model.updated_at_ms,
    }
}

pub fn estimate_to_dto(estimate: &lkjstr_app::RowGeometryEstimate) -> EstimateOutputDto {
    EstimateOutputDto {
        key: estimate.key.clone(),
        estimated_height_px: estimate.estimated_height_px,
        confidence: estimate.confidence,
        source: estimate_source(&estimate.source).to_owned(),
    }
}

pub fn semantic_event_from_dto(dto: &super::dto::PlanFragmentsInputDto) -> SemanticFeedEvent {
    SemanticFeedEvent {
        event_id: dto.event_id.clone(),
        event_kind: dto.event_kind,
        pubkey: dto.pubkey.clone(),
        created_at: dto.created_at,
        content: dto.content.clone(),
        media_attachments: Vec::new(),
        event_references: Vec::new(),
        media_count: dto.media_count,
        reference_count: dto.reference_count,
        relay_provenance: dto.relay_provenance.clone(),
        has_action_bar: dto.has_action_bar,
    }
}

pub fn fragment_config_from_dto(dto: Option<FragmentConfigDto>) -> FeedFragmentConfig {
    let default = FeedFragmentConfig::default();
    let Some(dto) = dto else { return default };
    FeedFragmentConfig {
        text_segment_target_chars: dto
            .text_segment_target_chars
            .unwrap_or(default.text_segment_target_chars),
        text_segment_max_chars: dto
            .text_segment_max_chars
            .unwrap_or(default.text_segment_max_chars),
        oversize_estimated_height_px: dto
            .oversize_estimated_height_px
            .unwrap_or(default.oversize_estimated_height_px),
        media_items_per_segment: dto
            .media_items_per_segment
            .unwrap_or(default.media_items_per_segment),
        references_per_segment: dto
            .references_per_segment
            .unwrap_or(default.references_per_segment),
    }
}

pub fn row_from_dto(dto: RowDto) -> MeasuredFeedRow {
    MeasuredFeedRow {
        key: dto.key,
        top_px: dto.top_px,
        height_px: dto.height_px,
    }
}

pub fn anchor_from_dto(dto: AnchorDto) -> FeedScrollAnchor {
    FeedScrollAnchor {
        row_key: dto.row_key,
        offset_inside_row_px: dto.offset_inside_row_px,
        viewport_relative_top_px: dto.viewport_relative_top_px,
        width_bucket: dto.width_bucket,
        generation: dto.generation,
        confidence: confidence_from_str(&dto.confidence),
    }
}

pub fn anchor_to_dto(anchor: &FeedScrollAnchor) -> AnchorDto {
    AnchorDto {
        row_key: anchor.row_key.clone(),
        offset_inside_row_px: anchor.offset_inside_row_px,
        viewport_relative_top_px: anchor.viewport_relative_top_px,
        width_bucket: anchor.width_bucket,
        generation: anchor.generation,
        confidence: confidence_to_string(&anchor.confidence),
    }
}

pub fn confidence_to_string(confidence: &AnchorConfidence) -> String {
    match confidence {
        AnchorConfidence::Exact => "exact",
        AnchorConfidence::Degraded => "degraded",
        AnchorConfidence::None => "none",
    }
    .to_owned()
}

fn row_kind_from_str(value: &str) -> RowKind {
    match value {
        "event-header" => RowKind::EventHeader,
        "event-text-segment" => RowKind::EventTextSegment,
        "event-media-segment" => RowKind::EventMediaSegment,
        "event-reference-segment" => RowKind::EventReferenceSegment,
        "event-actions" => RowKind::EventActions,
        "notification" => RowKind::Notification,
        "profile-summary" => RowKind::ProfileSummary,
        "thread-root" => RowKind::ThreadRoot,
        "footer" => RowKind::Footer,
        "unavailable" => RowKind::Unavailable,
        _ => RowKind::Event,
    }
}

fn confidence_from_str(value: &str) -> AnchorConfidence {
    match value {
        "exact" => AnchorConfidence::Exact,
        "degraded" => AnchorConfidence::Degraded,
        _ => AnchorConfidence::None,
    }
}

fn materialization_tier_from_str(value: &str) -> MaterializationTier {
    match value {
        "shell" => MaterializationTier::Shell,
        "enriched" => MaterializationTier::Enriched,
        _ => MaterializationTier::Structural,
    }
}

fn estimate_source(source: &GeometryEstimateSource) -> &'static str {
    match source {
        GeometryEstimateSource::ExactKey => "exact-key",
        GeometryEstimateSource::FeatureFormula => "feature-formula",
    }
}
