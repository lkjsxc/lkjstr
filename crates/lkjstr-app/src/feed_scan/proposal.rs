use super::config::ScanSpanConfig;
use super::diagnostic::ScanPlanDiagnostic;
use super::hierarchy::{ScanModelContext, scan_model_scope_weight, select_models_for_context};
use super::hint::FeedScanHint;
use super::model::{ScanDensityModel, ScanModelScope, decayed_sample_weight};
use super::span_cap::{SpanCapReason, change_capped_span, f64_to_span};

const NEUTRAL_PRIOR_WEIGHT: f64 = 0.001;

#[derive(Clone, Debug, PartialEq)]
pub struct SpanProposal {
    pub span_seconds: u64,
    pub target_count: u16,
    pub effective_limit: u16,
    pub estimated_density_events_per_second: f64,
    pub source_scope: ScanModelScope,
    pub confidence: f64,
    pub cap_applied: Option<SpanCapReason>,
    pub diagnostics: Vec<ScanPlanDiagnostic>,
}

#[must_use]
pub fn propose_scan_span(
    context: &ScanModelContext,
    models: &[ScanDensityModel],
    previous_hint: Option<&FeedScanHint>,
    effective_limit: u16,
    now_ms: u64,
    config: &ScanSpanConfig,
) -> SpanProposal {
    let target_count = config.target_count(effective_limit);
    let selected = select_models_for_context(models, context);
    let blend = density_blend(&selected, target_count, effective_limit, now_ms, config);
    let raw_span = f64::from(target_count)
        / blend
            .density
            .max(config.minimum_density_per_second)
            .max(f64::MIN_POSITIVE);
    let bounded = config.bounded_span(f64_to_span(raw_span, config.max_span_seconds));
    let previous_span = previous_usable_span(previous_hint, blend.source_model.as_ref(), config);
    let (span_seconds, cap_applied) = change_capped_span(bounded, previous_span, config);
    SpanProposal {
        span_seconds,
        target_count,
        effective_limit,
        estimated_density_events_per_second: blend.density,
        source_scope: blend.source_scope,
        confidence: blend.confidence,
        cap_applied,
        diagnostics: blend.diagnostics,
    }
}

struct DensityBlend {
    density: f64,
    source_scope: ScanModelScope,
    source_model: Option<ScanDensityModel>,
    confidence: f64,
    diagnostics: Vec<ScanPlanDiagnostic>,
}

fn density_blend(
    models: &[ScanDensityModel],
    target_count: u16,
    effective_limit: u16,
    now_ms: u64,
    config: &ScanSpanConfig,
) -> DensityBlend {
    let neutral_density = neutral_density(target_count, config);
    let contributions = model_contributions(models, now_ms, config);
    if contributions.is_empty() {
        return neutral_blend(neutral_density);
    }
    let total_weight = contributions.iter().map(|item| item.weight).sum::<f64>();
    let weighted_density = contributions
        .iter()
        .map(|item| item.model.density_events_per_second * item.weight)
        .sum::<f64>();
    let source = strongest_contribution(&contributions);
    let density = (weighted_density + (neutral_density * NEUTRAL_PRIOR_WEIGHT))
        / (total_weight + NEUTRAL_PRIOR_WEIGHT);
    DensityBlend {
        density,
        source_scope: source.model.scope.clone(),
        source_model: Some(source.model.clone()),
        confidence: confidence(total_weight, source.model, effective_limit),
        diagnostics: diagnostics_for_models(models, &contributions),
    }
}

fn neutral_blend(density: f64) -> DensityBlend {
    DensityBlend {
        density,
        source_scope: ScanModelScope::Neutral,
        source_model: None,
        confidence: 0.0,
        diagnostics: vec![ScanPlanDiagnostic::new("neutral scan density prior")],
    }
}

struct Contribution<'a> {
    model: &'a ScanDensityModel,
    weight: f64,
}

fn model_contributions<'a>(
    models: &'a [ScanDensityModel],
    now_ms: u64,
    config: &ScanSpanConfig,
) -> Vec<Contribution<'a>> {
    models
        .iter()
        .map(|model| Contribution {
            model,
            weight: decayed_sample_weight(model, now_ms, config)
                * scan_model_scope_weight(&model.scope)
                * quality_weight(model),
        })
        .filter(|item| item.weight > 0.0)
        .collect()
}

fn strongest_contribution<'a>(items: &'a [Contribution<'a>]) -> &'a Contribution<'a> {
    items.iter().fold(&items[0], |best, item| {
        if item.weight > best.weight {
            item
        } else {
            best
        }
    })
}

fn confidence(total_weight: f64, source: &ScanDensityModel, effective_limit: u16) -> f64 {
    let sample = total_weight / (total_weight + 1.0);
    let scope = scan_model_scope_weight(&source.scope).max(0.0);
    let limit_quality = if effective_limit == 0 { 0.5 } else { 1.0 };
    (sample * scope * quality_weight(source) * limit_quality).clamp(0.0, 1.0)
}

fn quality_weight(model: &ScanDensityModel) -> f64 {
    (1.0 - (model.incomplete_rate * 0.5) - (model.limit_hit_rate * 0.1)).clamp(0.1, 1.0)
}

fn diagnostics_for_models(
    models: &[ScanDensityModel],
    contributions: &[Contribution<'_>],
) -> Vec<ScanPlanDiagnostic> {
    if contributions.len() == models.len() {
        Vec::new()
    } else {
        vec![ScanPlanDiagnostic::new(
            "some scan models had decayed weight",
        )]
    }
}

fn previous_usable_span(
    hint: Option<&FeedScanHint>,
    source_model: Option<&ScanDensityModel>,
    config: &ScanSpanConfig,
) -> u64 {
    hint.map(FeedScanHint::bounded_next_span)
        .or_else(|| source_model.and_then(model_previous_span))
        .unwrap_or(config.neutral_span_seconds)
        .max(1)
}

fn model_previous_span(model: &ScanDensityModel) -> Option<u64> {
    if model.last_good_span_seconds > 0 {
        Some(model.last_good_span_seconds)
    } else if model.last_proposed_span_seconds > 0 {
        Some(model.last_proposed_span_seconds)
    } else {
        None
    }
}

fn neutral_density(target_count: u16, config: &ScanSpanConfig) -> f64 {
    f64::from(target_count) / config.neutral_span_seconds.max(1) as f64
}
