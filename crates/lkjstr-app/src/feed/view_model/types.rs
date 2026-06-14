use super::content::FeedEventContent;
use crate::{events::EventDisplayPlan, feed_geometry::RowGeometryEstimate};

pub const FEED_LOAD_OLDER_COMMAND: &str = "feed.loadOlder";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedRowRenderer {
    Event,
    Profile,
    Notification,
    Unavailable,
    Diagnostic,
    Continuation,
    Footer,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedFooterState {
    Loading,
    CacheHit,
    ReadingRelays,
    Partial,
    AuthRequired,
    RetryableFailure,
    ConfigurationUnavailable,
    TerminalEmpty,
    TerminalWithRows,
    OlderLoadReady,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedDiagnosticSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FeedViewModel {
    pub feed_id: String,
    pub rows: Vec<FeedViewRow>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum FeedViewRow {
    Event(FeedEventRow),
    Profile(FeedProfileRow),
    Notification(FeedNotificationRow),
    Unavailable(FeedUnavailableRow),
    Diagnostic(FeedDiagnosticRow),
    Continuation(FeedContinuationRow),
    Footer(FeedFooterRow),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedStateRow {
    Profile(FeedProfileRow),
    Notification(FeedNotificationRow),
    Unavailable(FeedUnavailableRow),
    Diagnostic(FeedDiagnosticRow),
    Continuation(FeedContinuationRow),
}

#[derive(Clone, Debug, PartialEq)]
pub struct FeedEventRow {
    pub row_id: String,
    pub event_id: String,
    pub author_pubkey: String,
    pub created_at: u64,
    pub event_kind: u64,
    pub relay_provenance: Vec<String>,
    pub display: EventDisplayPlan,
    pub content: FeedEventContent,
    pub geometry_estimate: RowGeometryEstimate,
    pub has_content_warning: bool,
    pub content_warning_reason: Option<String>,
    pub custom_emoji_count: u16,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedProfileRow {
    pub row_id: String,
    pub pubkey: String,
    pub display_name: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedNotificationRow {
    pub row_id: String,
    pub event_id: String,
    pub notification_kind: String,
    pub source_event_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedUnavailableRow {
    pub row_id: String,
    pub reason: String,
    pub subject: String,
    pub detail: String,
    pub retry_available: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedDiagnosticRow {
    pub row_id: String,
    pub scope: String,
    pub diagnostic_id: String,
    pub severity: FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedContinuationRow {
    pub row_id: String,
    pub target_event_id: String,
    pub hidden_count: usize,
    pub depth: u8,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedFooterRow {
    pub row_id: String,
    pub feed_id: String,
    pub state: FeedFooterState,
    pub command: Option<String>,
    pub disabled_reason: Option<String>,
    pub diagnostic_id: Option<String>,
}

impl FeedViewRow {
    #[must_use]
    pub fn row_id(&self) -> &str {
        match self {
            Self::Event(row) => &row.row_id,
            Self::Profile(row) => &row.row_id,
            Self::Notification(row) => &row.row_id,
            Self::Unavailable(row) => &row.row_id,
            Self::Diagnostic(row) => &row.row_id,
            Self::Continuation(row) => &row.row_id,
            Self::Footer(row) => &row.row_id,
        }
    }

    #[must_use]
    pub const fn renderer(&self) -> FeedRowRenderer {
        match self {
            Self::Event(_) => FeedRowRenderer::Event,
            Self::Profile(_) => FeedRowRenderer::Profile,
            Self::Notification(_) => FeedRowRenderer::Notification,
            Self::Unavailable(_) => FeedRowRenderer::Unavailable,
            Self::Diagnostic(_) => FeedRowRenderer::Diagnostic,
            Self::Continuation(_) => FeedRowRenderer::Continuation,
            Self::Footer(_) => FeedRowRenderer::Footer,
        }
    }
}

impl From<FeedStateRow> for FeedViewRow {
    fn from(row: FeedStateRow) -> Self {
        match row {
            FeedStateRow::Profile(row) => Self::Profile(row),
            FeedStateRow::Notification(row) => Self::Notification(row),
            FeedStateRow::Unavailable(row) => Self::Unavailable(row),
            FeedStateRow::Diagnostic(row) => Self::Diagnostic(row),
            FeedStateRow::Continuation(row) => Self::Continuation(row),
        }
    }
}
