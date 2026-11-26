//! Mirrors the frontend-owned web/src/engine/protocol.ts.
pub mod actions;
mod acts;
pub mod cache_hold;
mod cache_policy;
mod cache_read;
mod channels;
mod counts;
mod deep_links;
mod delivery;
mod emoji;
mod feedback;
mod generic_face;
mod list_edges;
mod mentions;
pub mod note;
mod notification_evidence;
mod notification_read;
mod notification_subject;
mod notifications;
mod output;
mod output_diff;
mod output_helpers;
mod output_patch;
mod people;
mod previews;
mod private_cache;
mod private_lists;
mod publish;
mod publish_types;
pub mod queries;
mod query_translate;
mod quote_state;
mod reading;
mod search;
mod sources;
use super::thread;
mod timeline;
mod timeline_answer;
mod timeline_clock;
mod timeline_days;
mod timeline_projected;
mod translate;
mod visibility;
mod visibility_state;
mod visibility_terminal;
mod window;
use queries::{Anchor, Config, Query};
use serde::{Deserialize, Serialize};
mod input_types;
mod output_types;
pub use input_types::Input;
pub use output_types::{AccountError, CryptContext, Failure, Output};
pub const PROTOCOL_VERSION: u32 = 17;
/// Adapter state is per transport client; the engine remains independent of pixels.
#[derive(Default)]
pub struct Session {
    client_scope: Option<u64>,
    // At most one permission per owned subscription, removed on close/reopen.
    cache_policies: std::collections::BTreeMap<String, bool>,
    cache_held: std::collections::BTreeMap<String, cache_hold::Held>,
    pub preview_near: std::collections::BTreeMap<String, Vec<String>>,
    pub preview_visible: Vec<String>,
    pub preview_save_data: bool,
    pub preview_hidden: bool,
    pub queries: std::collections::BTreeMap<String, Query>,
    pub config: Config,
    notification_states: std::collections::BTreeMap<String, notification_evidence::Cached>,
    private_states: std::collections::BTreeMap<String, private_lists::Cached>,
    searches: std::collections::BTreeMap<String, search::Cached>,
    timelines: std::collections::BTreeMap<String, timeline::Index>,
    timeline_turn: usize,
    return_keys: std::collections::BTreeMap<String, String>,
    timeline_visible: Option<std::collections::BTreeSet<String>>,
    pub(super) windows: std::collections::BTreeMap<String, (Option<String>, usize, usize)>,
    // One delivered tail key per head-following subscription, cleared on navigation.
    head_tails: std::collections::BTreeMap<String, String>,
    visibility_states: std::collections::BTreeMap<String, visibility_state::Cached>,
    // At most one pending navigation marker per open subscription.
    visibility_navigation: std::collections::BTreeSet<String>,
    reveals: std::collections::BTreeMap<String, visibility::Reveals>,
    pub(super) delivered: std::collections::BTreeMap<String, Vec<serde_json::Value>>,
}
impl Session {
    pub fn shared(client: u64) -> Self {
        Self {
            client_scope: Some(client),
            ..Self::default()
        }
    }

    fn view<'a>(&self, sub: &str, engine: &'a super::Engine) -> Option<&'a super::View> {
        match self.client_scope {
            Some(client) => engine.views.get(&format!("{client}:{sub}")),
            None => engine.views.get(sub),
        }
    }

    fn history_horizon(&self, sub: &str, engine: &super::Engine) -> Option<u64> {
        self.view(sub, engine)?.history_horizon
    }

    pub fn ready(shared: bool) -> Output {
        Self::ready_with_account_error(shared, None)
    }
    pub fn ready_account_unavailable(shared: bool) -> Output {
        Self::ready_with_account_error(shared, Some(AccountError::Internal))
    }
    fn ready_with_account_error(shared: bool, account_error: Option<AccountError>) -> Output {
        Output::Ready {
            account_error,
            version: PROTOCOL_VERSION,
            engine: if shared {
                "rust-wasm-shared"
            } else {
                "rust-wasm-worker"
            }
            .into(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelayConfig {
    pub url: String,
    pub read: bool,
    pub write: bool,
    pub search: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteRelayList {
    pub id: String,
    pub at: u64,
    pub urls: Vec<String>,
    #[serde(default, rename = "readOnly", skip_serializing_if = "Vec::is_empty")]
    pub read_only: Vec<String>,
}
impl WriteRelayList {
    pub fn is_newer_than(&self, other: &Self) -> bool {
        self.at > other.at || (self.at == other.at && self.id < other.id)
    }
}

/// Account badges use the same visible, grouped rows as the notifications feed.
pub fn unread_count(engine: &crate::engine::Engine, account: &str) -> usize {
    notifications::notifications(
        &Query {
            source: "notifications".into(),
            account: Some(account.into()),
            ..Default::default()
        },
        engine,
    )
    .iter()
    .filter(|row| row["unread"] == true)
    .count()
}

pub use notifications::notification_watermark;

pub use notification_evidence::unread_zap_evidence;
pub use notification_read::{NotificationMark, notification_read_mark};
