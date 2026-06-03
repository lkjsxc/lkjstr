use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OptimizerKeyProblem {
    TransientOwnerKey,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum StoredScanModelScope {
    Exact,
    RouteGroup,
    RelayFilter,
    SurfaceFilter,
    Surface,
    Global,
    Neutral,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ScanModelContextRecord {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: String,
    pub route_fingerprint: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ScanModelKeyRecord {
    pub scope: StoredScanModelScope,
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: String,
    pub route_fingerprint: String,
}

#[must_use]
pub fn scan_model_keys_for_context(context: &ScanModelContextRecord) -> Vec<ScanModelKeyRecord> {
    scan_model_scope_order()
        .iter()
        .map(|scope| scan_model_key_for_scope(context, scope.clone()))
        .collect()
}

#[must_use]
pub fn scan_model_key_for_scope(
    context: &ScanModelContextRecord,
    scope: StoredScanModelScope,
) -> ScanModelKeyRecord {
    ScanModelKeyRecord {
        semantic_feed_key: field(scope_uses_surface(&scope), &context.semantic_feed_key),
        route_group_key: field(scope_uses_route_group(&scope), &context.route_group_key),
        relay_url: field(scope_uses_relay(&scope), &context.relay_url),
        semantic_filter_key: field(scope_uses_filter(&scope), &context.semantic_filter_key),
        direction: context.direction.clone(),
        route_fingerprint: field(
            scope == StoredScanModelScope::Exact,
            &context.route_fingerprint,
        ),
        scope,
    }
}

pub fn scan_model_storage_key(key: &ScanModelKeyRecord) -> Result<String, OptimizerKeyProblem> {
    let parts = [
        key.scope.as_str(),
        key.semantic_feed_key.as_str(),
        key.route_group_key.as_str(),
        key.relay_url.as_str(),
        key.semantic_filter_key.as_str(),
        key.direction.as_str(),
        key.route_fingerprint.as_str(),
    ];
    if parts.iter().any(|part| contains_transient_owner_key(part)) {
        Err(OptimizerKeyProblem::TransientOwnerKey)
    } else {
        Ok(parts.join("\u{1f}"))
    }
}

#[must_use]
pub fn scan_model_scope_order() -> &'static [StoredScanModelScope] {
    &[
        StoredScanModelScope::Exact,
        StoredScanModelScope::RouteGroup,
        StoredScanModelScope::RelayFilter,
        StoredScanModelScope::SurfaceFilter,
        StoredScanModelScope::Surface,
        StoredScanModelScope::Global,
    ]
}

#[must_use]
pub fn scan_model_scope_rank(scope: &StoredScanModelScope) -> u8 {
    match scope {
        StoredScanModelScope::Exact => 0,
        StoredScanModelScope::RouteGroup => 1,
        StoredScanModelScope::RelayFilter => 2,
        StoredScanModelScope::SurfaceFilter => 3,
        StoredScanModelScope::Surface => 4,
        StoredScanModelScope::Global => 5,
        StoredScanModelScope::Neutral => 6,
    }
}

impl StoredScanModelScope {
    #[must_use]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Exact => "Exact",
            Self::RouteGroup => "RouteGroup",
            Self::RelayFilter => "RelayFilter",
            Self::SurfaceFilter => "SurfaceFilter",
            Self::Surface => "Surface",
            Self::Global => "Global",
            Self::Neutral => "Neutral",
        }
    }
}

pub(crate) fn contains_transient_owner_key(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("tab_id=")
        || lower.contains("tabid=")
        || lower.contains("tab:")
        || lower.contains("pane_id=")
        || lower.contains("paneid=")
        || lower.contains("pane:")
        || lower.contains("owner=")
        || lower.contains("request_id=")
        || lower.contains("subscription_id=")
}

fn field(used: bool, value: &str) -> String {
    if used {
        value.to_owned()
    } else {
        String::new()
    }
}

fn scope_uses_surface(scope: &StoredScanModelScope) -> bool {
    matches!(
        scope,
        StoredScanModelScope::Exact
            | StoredScanModelScope::RouteGroup
            | StoredScanModelScope::SurfaceFilter
            | StoredScanModelScope::Surface
    )
}

fn scope_uses_route_group(scope: &StoredScanModelScope) -> bool {
    matches!(
        scope,
        StoredScanModelScope::Exact | StoredScanModelScope::RouteGroup
    )
}

fn scope_uses_relay(scope: &StoredScanModelScope) -> bool {
    matches!(
        scope,
        StoredScanModelScope::Exact | StoredScanModelScope::RelayFilter
    )
}

fn scope_uses_filter(scope: &StoredScanModelScope) -> bool {
    matches!(
        scope,
        StoredScanModelScope::Exact
            | StoredScanModelScope::RelayFilter
            | StoredScanModelScope::SurfaceFilter
    )
}
