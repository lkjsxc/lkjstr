#![doc = "Custom Request pure types."]

use lkjstr_protocol::NostrFilter;
use lkjstr_relays::RequestRelayLimits;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequest {
    pub filters: Vec<NostrFilter>,
    pub relays: Vec<String>,
    pub sub_id: Option<String>,
    pub limit_clamps: Vec<CustomRequestLimitClamp>,
    pub relay_limit_clamps: Vec<CustomRequestRelayLimitClamp>,
    pub relay_filters: Vec<CustomRequestRelayFilters>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CustomRequestLimitClamp {
    pub filter_index: usize,
    pub original_limit: u64,
    pub effective_limit: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequestRelayLimitInput {
    pub relay_url: String,
    pub limits: RequestRelayLimits,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequestRelayLimitClamp {
    pub relay_url: String,
    pub filter_index: usize,
    pub original_limit: u64,
    pub effective_limit: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequestRelayFilters {
    pub relay_url: String,
    pub filters: Vec<NostrFilter>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CustomRequestMode {
    AdaptiveFeed,
    Exact,
}

impl CustomRequestMode {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::AdaptiveFeed => "adaptive-feed",
            Self::Exact => "exact",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CustomRequestErrorKind {
    JsonTooLarge,
    InvalidJson,
    InvalidShape,
    InvalidReqSubId,
    NoValidFilters,
    TooManyFilters,
    InvalidFilter,
    TooManyRelays,
    InvalidRelays,
    InvalidRelayUrl,
    TooManyIds,
    TooManyAuthors,
    TooManyTagValues,
    SearchTooLarge,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequestError {
    pub kind: CustomRequestErrorKind,
    pub detail: Option<String>,
}

impl CustomRequestError {
    #[must_use]
    pub fn new(kind: CustomRequestErrorKind) -> Self {
        Self { kind, detail: None }
    }

    #[must_use]
    pub fn with_detail(kind: CustomRequestErrorKind, detail: impl Into<String>) -> Self {
        Self {
            kind,
            detail: Some(detail.into()),
        }
    }
}
