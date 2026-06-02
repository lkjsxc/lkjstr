#![doc = "Custom Request pure types."]

use lkjstr_protocol::NostrFilter;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequest {
    pub filters: Vec<NostrFilter>,
    pub relays: Vec<String>,
    pub sub_id: Option<String>,
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
