use super::cursor::ScanDirection;
use super::model::{ScanDensityModel, ScanModelKey, ScanModelScope};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanModelContext {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirection,
    pub route_fingerprint: String,
}

#[must_use]
pub fn scan_model_key_for_scope(
    context: &ScanModelContext,
    scope: &ScanModelScope,
) -> ScanModelKey {
    ScanModelKey {
        semantic_feed_key: field(scope_uses_surface(scope), &context.semantic_feed_key),
        route_group_key: field(scope_uses_route_group(scope), &context.route_group_key),
        relay_url: field(scope_uses_relay(scope), &context.relay_url),
        semantic_filter_key: field(scope_uses_filter(scope), &context.semantic_filter_key),
        direction: context.direction.clone(),
        route_fingerprint: field(scope == &ScanModelScope::Exact, &context.route_fingerprint),
    }
}

#[must_use]
pub fn scan_model_keys_for_context(
    context: &ScanModelContext,
) -> Vec<(ScanModelScope, ScanModelKey)> {
    scan_model_scope_order()
        .iter()
        .filter(|scope| scope != &&ScanModelScope::Neutral)
        .map(|scope| (scope.clone(), scan_model_key_for_scope(context, scope)))
        .collect()
}

#[must_use]
pub fn select_models_for_context(
    models: &[ScanDensityModel],
    context: &ScanModelContext,
) -> Vec<ScanDensityModel> {
    let mut selected: Vec<ScanDensityModel> = models
        .iter()
        .filter(|model| model_matches_context(model, context))
        .cloned()
        .collect();
    selected.sort_by_key(|model| scan_model_scope_rank(&model.scope));
    selected
}

#[must_use]
pub fn model_matches_context(model: &ScanDensityModel, context: &ScanModelContext) -> bool {
    model.scope != ScanModelScope::Neutral
        && model.key.direction == context.direction
        && matches_field(
            scope_uses_surface(&model.scope),
            &model.key.semantic_feed_key,
            &context.semantic_feed_key,
        )
        && matches_field(
            scope_uses_route_group(&model.scope),
            &model.key.route_group_key,
            &context.route_group_key,
        )
        && matches_field(
            scope_uses_relay(&model.scope),
            &model.key.relay_url,
            &context.relay_url,
        )
        && matches_field(
            scope_uses_filter(&model.scope),
            &model.key.semantic_filter_key,
            &context.semantic_filter_key,
        )
        && matches_field(
            model.scope == ScanModelScope::Exact,
            &model.key.route_fingerprint,
            &context.route_fingerprint,
        )
}

#[must_use]
pub fn scan_model_scope_order() -> &'static [ScanModelScope] {
    &[
        ScanModelScope::Exact,
        ScanModelScope::RouteGroup,
        ScanModelScope::RelayFilter,
        ScanModelScope::SurfaceFilter,
        ScanModelScope::Surface,
        ScanModelScope::Global,
        ScanModelScope::Neutral,
    ]
}

#[must_use]
pub fn scan_model_scope_rank(scope: &ScanModelScope) -> u8 {
    match scope {
        ScanModelScope::Exact => 0,
        ScanModelScope::RouteGroup => 1,
        ScanModelScope::RelayFilter => 2,
        ScanModelScope::SurfaceFilter => 3,
        ScanModelScope::Surface => 4,
        ScanModelScope::Global => 5,
        ScanModelScope::Neutral => 6,
    }
}

#[must_use]
pub fn scan_model_scope_weight(scope: &ScanModelScope) -> f64 {
    match scope {
        ScanModelScope::Exact => 1.0,
        ScanModelScope::RouteGroup => 0.75,
        ScanModelScope::RelayFilter => 0.65,
        ScanModelScope::SurfaceFilter => 0.55,
        ScanModelScope::Surface => 0.40,
        ScanModelScope::Global => 0.25,
        ScanModelScope::Neutral => 0.0,
    }
}

fn field(used: bool, value: &str) -> String {
    if used {
        value.to_owned()
    } else {
        String::new()
    }
}

fn matches_field(used: bool, left: &str, right: &str) -> bool {
    !used || left == right
}

fn scope_uses_surface(scope: &ScanModelScope) -> bool {
    matches!(
        scope,
        ScanModelScope::Exact
            | ScanModelScope::RouteGroup
            | ScanModelScope::SurfaceFilter
            | ScanModelScope::Surface
    )
}

fn scope_uses_route_group(scope: &ScanModelScope) -> bool {
    matches!(scope, ScanModelScope::Exact | ScanModelScope::RouteGroup)
}

fn scope_uses_relay(scope: &ScanModelScope) -> bool {
    matches!(scope, ScanModelScope::Exact | ScanModelScope::RelayFilter)
}

fn scope_uses_filter(scope: &ScanModelScope) -> bool {
    matches!(
        scope,
        ScanModelScope::Exact | ScanModelScope::RelayFilter | ScanModelScope::SurfaceFilter
    )
}
