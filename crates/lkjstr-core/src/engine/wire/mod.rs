//! Mirrors the frontend-owned web/src/engine/protocol.ts.
pub mod actions;
pub mod cache_hold;
mod cache_policy;
mod cache_read;
mod channels;
mod counts;
mod delivery;
mod feedback;
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
mod people;
mod previews;
mod private_cache;
mod private_lists;
mod publish;
pub mod queries;
mod query_translate;
mod quote_state;
mod reading;
mod search;
mod sources;
use super::thread;
mod timeline;
mod translate;
use queries::{Anchor, Config, Query};
use serde::Deserialize;
mod input_types;
mod output_types;
pub use input_types::Input;
pub use output_types::{CryptContext, Failure, Output};
pub const PROTOCOL_VERSION: u32 = 13;
/// Adapter state is per transport client; the engine remains independent of pixels.
#[derive(Default)]
pub struct Session {
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
    pub(super) delivered: std::collections::BTreeMap<String, Vec<serde_json::Value>>,
}
impl Session {
    pub fn ready(shared: bool) -> Output {
        Output::Ready {
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
