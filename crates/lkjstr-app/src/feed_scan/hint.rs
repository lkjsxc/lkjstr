use super::cursor::ScanDirection;
use super::feedback::ScanWindowFeedback;

#[derive(Clone, Debug, PartialEq)]
pub struct FeedScanHint {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirection,
    pub route_fingerprint: String,
    pub current_span_seconds: u64,
    pub next_span_seconds: u64,
    pub min_span_seconds: u64,
    pub max_span_seconds: u64,
    pub last_feedback: ScanWindowFeedback,
    pub density_ewma: f64,
    pub complete_window_count: u64,
    pub dense_window_count: u64,
    pub incomplete_window_count: u64,
    pub last_since: u64,
    pub last_until: u64,
    pub updated_at_seconds: u64,
    pub expires_at_seconds: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum HintCompatibility {
    Compatible,
    Expired,
    Incompatible,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ScanHintStatus {
    Unavailable,
    Used,
    Expired,
    Rejected,
}

impl ScanHintStatus {
    #[must_use]
    pub fn as_kebab_str(self) -> &'static str {
        match self {
            Self::Unavailable => "unavailable",
            Self::Used => "used",
            Self::Expired => "expired",
            Self::Rejected => "rejected",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HintContext {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirection,
    pub route_fingerprint: String,
    pub now_seconds: u64,
}

impl FeedScanHint {
    pub fn compatibility(&self, context: &HintContext) -> HintCompatibility {
        if self.expires_at_seconds <= context.now_seconds {
            return HintCompatibility::Expired;
        }
        if self.semantic_feed_key == context.semantic_feed_key
            && self.route_group_key == context.route_group_key
            && self.relay_url == context.relay_url
            && self.semantic_filter_key == context.semantic_filter_key
            && self.direction == context.direction
            && self.route_fingerprint == context.route_fingerprint
        {
            HintCompatibility::Compatible
        } else {
            HintCompatibility::Incompatible
        }
    }

    pub fn bounded_next_span(&self) -> u64 {
        self.next_span_seconds
            .clamp(self.min_span_seconds, self.max_span_seconds)
    }
}
